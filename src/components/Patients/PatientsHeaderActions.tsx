import React, { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { Patient } from '@/types/Patient';
import { autoConfigureOpenMRS } from '@/utils/config';

type PatientsHeaderActionsProps = {
    selectedPatient: Patient[];
    onCreatePatient: () => void;
    onTestConnection: () => void;
    testConnectionState: 'idle' | 'testing' | 'success' | 'error';
    isOpenMRSConnected: boolean;
};

export function PatientsHeaderActions({
    selectedPatient,
    onCreatePatient,
    onTestConnection,
    testConnectionState,
    isOpenMRSConnected,
}: PatientsHeaderActionsProps) {
    const navigate = useNavigate();
    const [autoDetecting, setAutoDetecting] = useState(false);

    // Disable patient action buttons if nothing is selected
    const actionButtonDisabled = useMemo(() => selectedPatient.length === 0, [selectedPatient]);

    const handleAutoDetect = async () => {
        setAutoDetecting(true);
        try {
            const result = await autoConfigureOpenMRS();
            if (result.success) {
                console.log('Auto-configured OpenMRS URL:', result.url);
                // Trigger a connection test with the new URL
                setTimeout(onTestConnection, 500);
            } else {
                console.error('Auto-detection failed:', result.error);
            }
        } catch (error) {
            console.error('Auto-detection error:', error);
        } finally {
            setAutoDetecting(false);
        }
    };

    return (
        <SpaceBetween direction="horizontal" size="s">
            <Button
                onClick={onTestConnection}
                loading={testConnectionState === 'testing'}
                iconName={
                    testConnectionState === 'success'
                        ? 'status-positive'
                        : testConnectionState === 'error'
                          ? 'status-negative'
                          : 'status-info'
                }
                variant="normal"
            >
                {testConnectionState === 'success'
                    ? 'OpenMRS Connected'
                    : testConnectionState === 'error'
                      ? 'Test OpenMRS Connection'
                      : testConnectionState === 'testing'
                        ? 'Testing...'
                        : 'Test OpenMRS Connection'}
            </Button>
            {testConnectionState === 'error' && (
                <Button onClick={handleAutoDetect} loading={autoDetecting} iconName="refresh" variant="normal">
                    {autoDetecting ? 'Auto-detecting...' : 'Auto-detect URL'}
                </Button>
            )}
            <div style={{ width: '24px' }} /> {/* Extra space between buttons */}
            <Button onClick={onCreatePatient} iconName="add-plus" disabled={!isOpenMRSConnected}>
                Create New Patient
            </Button>
            <Button
                variant={'primary'}
                disabled={actionButtonDisabled}
                onClick={() => navigate(`/patient/${selectedPatient[0]?.uuid}`)}
            >
                View Patient
            </Button>
        </SpaceBetween>
    );
}
