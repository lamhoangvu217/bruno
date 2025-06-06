import path from 'utils/common/path';
import { toast } from 'react-hot-toast';
import { callIpc } from 'utils/common/ipc';

/**
 * Commits a file to git repository
 * 
 * @param {string} filePath - Path to the file to commit
 * @returns {Promise} - A promise that resolves when the commit is complete
 */
export const commitFileToGit = async (filePath) => {
  console.log('commitFileToGit called with path:', filePath);
  try {
    // Get the file name for the commit message
    const fileName = path.basename(filePath);
    
    // Use IPC to call the main process to handle git operations
    // This avoids the fs_1.statSync issue in the renderer process
    const { ipcRenderer } = window;
    
    console.log('ipcRenderer available:', !!ipcRenderer);
    
    if (!ipcRenderer) {
      console.log('IPC renderer not available, skipping git commit');
      return;
    }
    
    // Show a loading toast for the git operation
    const toastId = toast.loading('Committing and pushing to git...');
    
    // Call the main process to handle git operations
    console.log('About to invoke renderer:git-commit with:', {
      filePath,
      commitMessage: `Update request: ${fileName}`
    });
    
    const result = await ipcRenderer.invoke('renderer:git-commit', {
      filePath,
      commitMessage: `Update request: ${fileName}`
    });
    
    console.log('Git commit result:', result);
    
    // Update the toast based on the result
    if (result.success) {
      if (result.message.includes('push successful')) {
        toast.success('Committed and pushed to git successfully', { id: toastId });
      } else if (result.message.includes('no remote')) {
        toast.success('Committed to git successfully (no remote to push to)', { id: toastId });
      } else if (result.message.includes('push failed')) {
        toast.error(`Committed to git but push failed: ${result.message.split('push failed: ')[1]}`, { id: toastId });
      } else {
        toast.success('Committed to git successfully', { id: toastId });
      }
    } else {
      toast.error(`Git operation failed: ${result.message}`, { id: toastId });
    }
    
    console.log(`Successfully committed ${fileName} to git repository`);
  } catch (error) {
    console.error('Error committing to git:', error);
    // Don't show error toast to user as this is a background operation
    // that shouldn't interrupt their workflow if it fails
    console.log('Git commit error details:', error.message || error);
  }
};
