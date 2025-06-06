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
};

module.exports = registerGitIpc;
