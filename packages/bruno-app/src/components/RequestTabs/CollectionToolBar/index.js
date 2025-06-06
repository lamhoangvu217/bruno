import React from 'react';
import { uuid } from 'utils/common';
import { IconFiles, IconRun, IconEye, IconSettings, IconRefresh } from '@tabler/icons';
import EnvironmentSelector from 'components/Environments/EnvironmentSelector';
import GlobalEnvironmentSelector from 'components/GlobalEnvironments/EnvironmentSelector';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { useDispatch } from 'react-redux';
import ToolHint from 'components/ToolHint';
import { toast } from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';
import JsSandboxMode from 'components/SecuritySettings/JsSandboxMode';

const CollectionToolBar = ({ collection }) => {
  const dispatch = useDispatch();

  const handleRun = () => {
    dispatch(
      addTab({
        uid: uuid(),
        collectionUid: collection.uid,
        type: 'collection-runner'
      })
    );
  };

  const viewVariables = () => {
    dispatch(
      addTab({
        uid: uuid(),
        collectionUid: collection.uid,
        type: 'variables'
      })
    );
  };

  const viewCollectionSettings = () => {
    dispatch(
      addTab({
        uid: collection.uid,
        collectionUid: collection.uid,
        type: 'collection-settings'
      })
    );
  };

  const syncData = async () => {
    const toastId = toast.loading('Syncing data from git...');
    try {
      const { ipcRenderer } = window;
      if (!ipcRenderer) {
        toast.error('IPC renderer not available');
        return;
      }
      
      const result = await ipcRenderer.invoke('renderer:git-pull');
      
      if (result && result.success) {
        toast.success('Successfully synced data from git');
      } else {
        toast.error(`Failed to sync: ${result?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error(`Error syncing data: ${error.message}`);
    } finally {
      toast.dismiss(toastId);
    }
  };

  return (
    <StyledWrapper>
      <div className="flex items-center p-2">
        <div className="flex flex-1 items-center cursor-pointer hover:underline" onClick={viewCollectionSettings}>
          <IconFiles size={18} strokeWidth={1.5} />
          <span className="ml-2 mr-4 font-semibold">{collection?.name}</span>
        </div>
        <div className="flex flex-3 items-center justify-end">
          <span className="mr-2">
            <JsSandboxMode collection={collection} />
          </span>
          <span className="mr-3">
            <ToolHint text="Runner" toolhintId="RunnnerToolhintId" place='bottom'>
              <IconRun className="cursor-pointer" size={18} strokeWidth={1.5} onClick={handleRun} />
            </ToolHint>
          </span>
          <span className="mr-3">
            <ToolHint text="Variables" toolhintId="VariablesToolhintId">
              <IconEye className="cursor-pointer" size={18} strokeWidth={1.5} onClick={viewVariables} />
            </ToolHint>
          </span>
          <span className="mr-3">
            <ToolHint text="Collection Settings" toolhintId="CollectionSettingsToolhintId">
              <IconSettings className="cursor-pointer" size={18} strokeWidth={1.5} onClick={viewCollectionSettings} />
            </ToolHint>
          </span>
          <span>
            <GlobalEnvironmentSelector />
          </span>
          <span className="mr-3">
            <ToolHint text="Sync Data" toolhintId="SyncDataToolhintId">
              <IconRefresh className="cursor-pointer" size={18} strokeWidth={1.5} onClick={syncData} />
            </ToolHint>
          </span>
          <EnvironmentSelector collection={collection} />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CollectionToolBar;
