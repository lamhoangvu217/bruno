const { ipcMain } = require('electron');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

/**
 * Register git-related IPC handlers
 * 
 * @param {BrowserWindow} mainWindow - The main browser window
 */
const registerGitIpc = (mainWindow) => {
  console.log('Registering Git IPC handlers...');
  // Handle git commit requests from the renderer process
  console.log('Setting up renderer:git-commit handler');
  ipcMain.handle('renderer:git-commit', async (event, { filePath, commitMessage }) => {
    console.log('Received git commit request:', { filePath, commitMessage });
    try {
      // Get the repository root directory (parent directory of the file)
      const repoPath = path.dirname(filePath);
      
      console.log("File path:", filePath);
      console.log("Repository path:", repoPath);
      console.log("File exists:", fs.existsSync(filePath));
      
      // Initialize git in the repository directory
      const git = simpleGit(repoPath);
      console.log("Git instance created:", !!git);
      // Check if the directory is a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        console.log('Not a git repository, skipping commit');
        return { success: false, message: 'Not a git repository' };
      }

      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.log(`File ${filePath} does not exist, skipping commit`);
        return { success: false, message: 'File does not exist' };
      }

      // Add the file to git
      await git.add(filePath);
      
      // Commit the file with the provided message
      const commitResult = await git.commit(commitMessage);
      
      console.log(`Successfully committed ${path.basename(filePath)} to git repository`);
      console.log("commitResult", commitResult);
      
      try {
        // Check if there's a remote repository configured
        const remotes = await git.getRemotes();
        console.log("remotes", remotes);
        if (remotes && remotes.length > 0) {
          console.log('Remote repository found, pushing changes...');
          // Get current branch
          const branchSummary = await git.branch();
          const currentBranch = branchSummary.current;
          
          // Push to the remote repository
          console.log('Pushing to remote repository...');
          const pushResult = await git.push('origin', currentBranch);
          console.log('Push successful:', pushResult);
          return { success: true, message: 'push successful', result: { commit: commitResult, push: pushResult } };
        } else {
          console.log('No remote repository configured, skipping push');
          return { success: true, message: 'no remote to push to', result: commitResult };
        }
      } catch (pushError) {
        console.error('Error pushing to remote:', pushError);
        // Still return success for the commit even if push fails
        return { success: true, message: 'Commit successful, but push failed: ' + pushError.message, result: commitResult };
      }
    } catch (error) {
      console.error('Error committing to git:', error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  });

  // Handle git pull requests from the renderer process
  console.log('Setting up renderer:git-pull handler');
  ipcMain.handle('renderer:git-pull', async (event) => {
    console.log('Received git pull request');
    try {
      // Get the repository path from environment variable or use a default path
      // This assumes the repository path is the same as where the app is looking for collections
      const repoPath = process.env.BRUNO_COLLECTION_PATH || path.join(process.env.HOME || process.env.USERPROFILE, 'Documents/Bruno_CraziGoods');
      
      console.log("Repository path for pull:", repoPath);
      
      // Initialize git in the repository directory
      const git = simpleGit(repoPath);
      
      // Check if the directory is a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        console.log('Not a git repository, cannot pull');
        return { success: false, message: 'Not a git repository' };
      }

      // Check if there's a remote repository configured
      const remotes = await git.getRemotes();
      if (!remotes || remotes.length === 0) {
        console.log('No remote repository configured, cannot pull');
        return { success: false, message: 'No remote repository configured' };
      }

      // Get current branch
      const branchSummary = await git.branch();
      const currentBranch = branchSummary.current;
      
      // Pull from the remote repository
      console.log(`Pulling from remote repository on branch ${currentBranch}...`);
      
      // First fetch to get remote branches
      await git.fetch('origin');
      
      // Get list of remote branches
      const remoteBranches = await git.branch(['-r']);
      console.log('Remote branches:', remoteBranches);
      
      // Determine which branch to use
      let branchToUse = null;
      
      // Check if origin/main exists
      if (remoteBranches.all.includes('origin/main')) {
        branchToUse = 'main';
      } 
      // Check if origin/master exists
      else if (remoteBranches.all.includes('origin/master')) {
        branchToUse = 'master';
      }
      // Otherwise use current branch if it has a remote
      else if (remoteBranches.all.includes(`origin/${currentBranch}`)) {
        branchToUse = currentBranch;
      }
      
      if (!branchToUse) {
        console.error('No valid remote branch found');
        return { success: false, message: 'No valid remote branch found' };
      }
      
      console.log(`Using branch: ${branchToUse}`);
      
      try {
        // First try with standard options plus conflict resolution
        try {
          // Use --strategy=recursive and --strategy-option=theirs to automatically resolve conflicts
          // in favor of the remote changes
          const pullOptions = ['--no-rebase', '--strategy=recursive', '--strategy-option=theirs'];
          
          // Pull with the selected branch and strategy options
          const pullResult = await git.pull('origin', branchToUse, pullOptions);
          console.log(`Pull from ${branchToUse} successful:`, pullResult);
          
          return { 
            success: true, 
            message: `Successfully pulled latest changes from ${branchToUse} branch`, 
            result: pullResult 
          };
        } catch (pullError) {
          console.error(`Error pulling from ${branchToUse} branch:`, pullError);
          
          // Check if the error is about unrelated histories
          const isUnrelatedHistoriesError = pullError.message && 
            (pullError.message.includes('refusing to merge unrelated histories') ||
             (pullError.git && pullError.git.message && pullError.git.message.includes('refusing to merge unrelated histories')));
          
          if (isUnrelatedHistoriesError) {
            console.log('Detected unrelated histories error, trying with --allow-unrelated-histories');
            
            // Try again with the allow-unrelated-histories flag
            const pullOptions = ['--allow-unrelated-histories', '--strategy=recursive', '--strategy-option=theirs'];
            const pullResult = await git.pull('origin', branchToUse, pullOptions);
            
            console.log(`Pull with --allow-unrelated-histories successful:`, pullResult);
            return { 
              success: true, 
              message: `Successfully pulled latest changes from ${branchToUse} branch (unrelated histories merged)`, 
              result: pullResult 
            };
          } else {
            // If it's not an unrelated histories error, rethrow
            throw pullError;
          }
        }
      } catch (pullError) {
        console.error(`All pull attempts failed for ${branchToUse} branch:`, pullError);
        
        // If all pull attempts fail, try a more aggressive approach: fetch + reset
        try {
          console.log('Attempting fetch and hard reset to remote branch...');
          
          // Fetch the latest from remote
          await git.fetch('origin', branchToUse);
          
          // Hard reset to the fetched branch
          await git.reset('hard', [`origin/${branchToUse}`]);
          
          return {
            success: true,
            message: `Successfully synced with remote using hard reset to ${branchToUse}`,
            result: { reset: true, branch: branchToUse }
          };
        } catch (resetError) {
          console.error('Error during fetch and reset:', resetError);
          throw new Error(`Failed to sync with remote: ${resetError.message}`);
        }
      }

    } catch (error) {
      console.error('Error pulling from git:', error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  });
};

module.exports = registerGitIpc;
