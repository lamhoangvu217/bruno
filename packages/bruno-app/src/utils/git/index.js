import { simpleGit } from 'simple-git';
import path from 'utils/common/path';
import toast from 'react-hot-toast';

/**
 * Commits a file to git repository
 * 
 * @param {string} filePath - The absolute path of the file to commit
 * @returns {Promise} - A promise that resolves when the commit is complete
 */
export const commitFileToGit = async (filePath) => {
  try {
    // Get the repository root directory (parent directory of the file)
    const repoPath = path.dirname(filePath);
    
    // Initialize git in the repository directory
    const git = simpleGit(repoPath);
    
    // Check if the directory is a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log('Not a git repository, skipping commit');
      return;
    }

    // Get the file name for the commit message
    const fileName = path.basename(filePath);
    
    // Add the file to git
    await git.add(filePath);
    
    // Commit the file with a message
    await git.commit(`Update request: ${fileName}`);
    
    console.log(`Successfully committed ${fileName} to git repository`);
  } catch (error) {
    console.error('Error committing to git:', error);
    toast.error('Failed to commit to git repository');
    throw error;
  }
};
