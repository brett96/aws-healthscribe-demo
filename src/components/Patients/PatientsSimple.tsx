// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { appConfig } from '@/utils/config';

export default function PatientsSimple() {
    const [testConnection, setTestConnection] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleTestConnection = async () => {
        setTestConnection('testing');
        setErrorMessage('');

        try {
            const response = await fetch(`${appConfig.openmrs.baseUrl}/ws/rest/v1/session`, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${btoa(`${appConfig.openmrs.username}:${appConfig.openmrs.password}`)}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                setTestConnection('success');
            } else {
                setTestConnection('error');
                setErrorMessage(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            setTestConnection('error');
            setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        }
    };

    return (
        <ContentLayout
            headerVariant={'high-contrast'}
            header={
                <Header variant="awsui-h1-sticky" description="OpenMRS integration for patient management">
                    Patients (OpenMRS Integration)
                </Header>
            }
        >
            <SpaceBetween direction="vertical" size="l">
                <Alert statusIconAriaLabel="Info" header="OpenMRS Integration Setup">
                    This page integrates with OpenMRS to manage patient records. Make sure you have OpenMRS running and
                    accessible.
                </Alert>

                <Box>
                    <SpaceBetween direction="vertical" size="m">
                        <div key="configuration-info">
                            <strong>Current Configuration:</strong>
                            <ul>
                                <li key="base-url">OpenMRS Base URL: {appConfig.openmrs.baseUrl}</li>
                                <li key="username">Username: {appConfig.openmrs.username}</li>
                                <li key="integration-enabled">
                                    Integration Enabled: {appConfig.features.enableOpenMRSIntegration ? 'Yes' : 'No'}
                                </li>
                            </ul>
                        </div>

                        <div key="test-button">
                            <Button
                                variant="primary"
                                onClick={handleTestConnection}
                                loading={testConnection === 'testing'}
                            >
                                Test OpenMRS Connection
                            </Button>
                        </div>

                        {testConnection === 'success' && (
                            <Alert
                                key="success-alert"
                                statusIconAriaLabel="Success"
                                type="success"
                                header="Connection Successful"
                            >
                                Successfully connected to OpenMRS! You can now search and manage patients.
                            </Alert>
                        )}

                        {testConnection === 'error' && (
                            <Alert
                                key="error-alert"
                                statusIconAriaLabel="Error"
                                type="error"
                                header="Connection Failed"
                            >
                                Failed to connect to OpenMRS: {errorMessage}
                                <br />
                                <br />
                                <strong>Troubleshooting:</strong>
                                <ul>
                                    <li key="check-running">
                                        Make sure OpenMRS is running at {appConfig.openmrs.baseUrl}
                                    </li>
                                    <li key="check-credentials">Check that the credentials are correct</li>
                                    <li key="check-cors">
                                        Verify CORS is configured to allow requests from this domain
                                    </li>
                                    <li key="check-console">Check the browser console for additional error details</li>
                                </ul>
                            </Alert>
                        )}

                        <Alert key="next-steps-alert" statusIconAriaLabel="Info" header="Next Steps">
                            <ol>
                                <li key="setup-openmrs">
                                    Set up OpenMRS using Docker or the OpenMRS SDK (see OPENMRS_INTEGRATION.md)
                                </li>
                                <li key="test-connection">Test the connection using the button above</li>
                                <li key="use-interface">
                                    Once connected, the full patient management interface will be available
                                </li>
                            </ol>
                        </Alert>
                    </SpaceBetween>
                </Box>
            </SpaceBetween>
        </ContentLayout>
    );
}
