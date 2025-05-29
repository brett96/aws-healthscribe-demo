// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// To connect to OpenMRS on a VM, update the configuration:
// import { updateConfig } from '@/utils/config';
// updateConfig({
//     openmrs: {
//         baseUrl: 'http://YOUR_VM_IP:8080/openmrs',
//         username: 'admin',
//         password: 'Admin123',
//     }
// });
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useCollection } from '@cloudscape-design/collection-hooks';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Pagination from '@cloudscape-design/components/pagination';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';

import { PatientsFilter } from '@/components/Patients/PatientsFilter';
import { PatientsHeaderActions } from '@/components/Patients/PatientsHeaderActions';
import TableEmptyState from '@/components/Patients/TableEmptyState';
import { TablePreferences } from '@/components/Patients/TablePreferences';
import { columnDefs } from '@/components/Patients/patientsColumnDefs';
import { DEFAULT_PREFERENCES } from '@/components/Patients/patientsPrefs';
import { useNotificationsContext } from '@/store/notifications';
import { Patient } from '@/types/Patient';
import {
    createPatient,
    findSuitableIdentifierType,
    generateNumericPatientId,
    getPatient,
    searchPatients,
    testOpenMRSConnection,
} from '@/utils/OpenMRSApi';
import { appConfig } from '@/utils/config';

// Test View
// import { PatientsFilter } from './PatientsFilter';
// import { PatientsHeaderActions } from './PatientsHeaderActions';
// import TableEmptyState from './TableEmptyState';
// import { TablePreferences } from './TablePreferences';
// import { columnDefs } from './patientsColumnDefs';
// import { DEFAULT_PREFERENCES } from './patientsPrefs';

export default function Patients() {
    const { addFlashMessage } = useNotificationsContext();

    // OpenMRS connection state
    const [testConnection, setTestConnection] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [isOpenMRSConnected, setIsOpenMRSConnected] = useState(false);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient[] | []>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);

    // New patient form state
    const [newPatient, setNewPatient] = useState({
        givenName: '',
        familyName: '',
        gender: '',
        birthdate: '',
        identifier: '',
    });

    const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>(DEFAULT_PREFERENCES);

    // Header counter for the number of patients
    const headerCounterText = `(${patients.length})`;

    // Test OpenMRS connection
    const handleTestConnection = async () => {
        setTestConnection('testing');

        try {
            // Use the improved connection test function
            const connected = await testOpenMRSConnection();

            if (connected) {
                setTestConnection('success');
                setIsOpenMRSConnected(true);
                addFlashMessage({
                    id: 'openmrs-connection-success',
                    header: 'OpenMRS Connection Successful',
                    content:
                        'Successfully connected to OpenMRS with valid session! You can now search and manage patients.',
                    type: 'success',
                });
            } else {
                setTestConnection('error');
                setIsOpenMRSConnected(false);
                addFlashMessage({
                    id: 'openmrs-connection-error',
                    header: 'OpenMRS Connection Failed',
                    content:
                        'Failed to connect to OpenMRS. Please check your OpenMRS server is running and accessible.',
                    type: 'error',
                });
            }
        } catch (error) {
            setTestConnection('error');
            setIsOpenMRSConnected(false);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            addFlashMessage({
                id: 'openmrs-connection-error',
                header: 'OpenMRS Connection Failed',
                content: `Failed to connect to OpenMRS: ${errorMessage}`,
                type: 'error',
            });
        }
    };

    // Search patients in OpenMRS
    const searchPatientsWrapper = useCallback(
        async (query: string) => {
            if (!query.trim()) {
                setPatients([]);
                return;
            }

            if (!isOpenMRSConnected) {
                addFlashMessage({
                    id: 'openmrs-not-connected-search',
                    header: 'OpenMRS Not Connected',
                    content: 'Please test and establish a connection to OpenMRS before searching patients.',
                    type: 'error',
                });
                return;
            }

            setTableLoading(true);
            try {
                const response = (await searchPatients(query)) as { results: Patient[] };
                setPatients(response.results || []);
            } catch (e: unknown) {
                setTableLoading(false);
                addFlashMessage({
                    id: e?.toString() || 'Search patients error',
                    header: 'Patients Search Error',
                    content: e?.toString() || 'Failed to search patients',
                    type: 'error',
                });
            }
            setTableLoading(false);
        },
        [addFlashMessage, isOpenMRSConnected]
    );

    // Create new patient
    const handleCreatePatient = async () => {
        if (!isOpenMRSConnected) {
            addFlashMessage({
                id: 'openmrs-not-connected',
                header: 'OpenMRS Not Connected',
                content: 'Please test and establish a connection to OpenMRS before creating patients.',
                type: 'error',
            });
            return;
        }

        if (!newPatient.givenName || !newPatient.familyName || !newPatient.gender) {
            addFlashMessage({
                id: 'validation-error',
                header: 'Validation Error',
                content: 'Please fill in all required fields',
                type: 'error',
            });
            return;
        }

        setCreateLoading(true);
        try {
            // Find a suitable identifier type and generate an identifier if none provided
            const identifierType = await findSuitableIdentifierType();
            const patientIdentifier = newPatient.identifier?.trim() || generateNumericPatientId();

            const patientData = {
                person: {
                    names: [
                        {
                            givenName: newPatient.givenName,
                            familyName: newPatient.familyName,
                        },
                    ],
                    gender: newPatient.gender,
                    birthdate: newPatient.birthdate,
                },
                // Always include identifiers array with a valid identifier
                identifiers: [
                    {
                        identifier: patientIdentifier,
                        identifierType: identifierType,
                    },
                ],
            };

            console.log('Creating patient with suitable identifier type:', patientData);
            const createdPatient = (await createPatient(patientData)) as Patient;

            addFlashMessage({
                id: 'patient-created',
                header: 'Patient Created',
                content: `Patient ${createdPatient.display} created successfully`,
                type: 'success',
            });

            setShowCreateModal(false);
            setNewPatient({
                givenName: '',
                familyName: '',
                gender: '',
                birthdate: '',
                identifier: '',
            });

            // Refresh search if there's a query
            if (searchQuery) {
                await searchPatientsWrapper(searchQuery);
            }
        } catch (e: unknown) {
            addFlashMessage({
                id: e?.toString() || 'Create patient error',
                header: 'Create Patient Error',
                content: e?.toString() || 'Failed to create patient',
                type: 'error',
            });
        }
        setCreateLoading(false);
    };

    // Test OpenMRS connection on component mount
    useEffect(() => {
        const testInitialConnection = async () => {
            try {
                const connected = await testOpenMRSConnection();

                if (connected) {
                    setIsOpenMRSConnected(true);
                    setTestConnection('success');
                } else {
                    setIsOpenMRSConnected(false);
                    setTestConnection('error');
                }
            } catch (error) {
                setIsOpenMRSConnected(false);
                setTestConnection('error');
                console.error('Initial OpenMRS connection test failed:', error);
            }
        };

        testInitialConnection();
    }, []);

    // Table collection
    const { items, actions, collectionProps, paginationProps } = useCollection(patients, {
        filtering: {
            empty: (
                <TableEmptyState title="No patients found" subtitle="Try searching for a patient name or identifier." />
            ),
            noMatch: (
                <TableEmptyState
                    title="No matches"
                    subtitle="We cannot find a match."
                    action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
                />
            ),
        },
        pagination: { pageSize: preferences.pageSize },
        sorting: {},
        selection: {},
    });

    return (
        <>
            <ContentLayout
                headerVariant={'high-contrast'}
                header={
                    <Header
                        variant="awsui-h1-sticky"
                        description="Search and manage patient records from OpenMRS"
                        counter={headerCounterText}
                        actions={
                            <PatientsHeaderActions
                                selectedPatient={selectedPatient}
                                onCreatePatient={() => setShowCreateModal(true)}
                                onTestConnection={handleTestConnection}
                                testConnectionState={testConnection}
                                isOpenMRSConnected={isOpenMRSConnected}
                            />
                        }
                    >
                        Patients
                    </Header>
                }
            >
                <Table
                    {...collectionProps}
                    columnDefinitions={columnDefs}
                    columnDisplay={preferences.contentDisplay}
                    contentDensity={preferences.contentDensity}
                    filter={
                        <PatientsFilter
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onSearch={searchPatientsWrapper}
                            isOpenMRSConnected={isOpenMRSConnected}
                        />
                    }
                    items={items}
                    loading={tableLoading}
                    loadingText="Searching patients"
                    onSelectionChange={({ detail }) => setSelectedPatient(detail.selectedItems)}
                    pagination={<Pagination {...paginationProps} />}
                    preferences={<TablePreferences preferences={preferences} setPreferences={setPreferences} />}
                    resizableColumns={true}
                    selectedItems={selectedPatient}
                    selectionType="single"
                    stickyColumns={preferences.stickyColumns}
                    stickyHeader={true}
                    stripedRows={preferences.stripedRows}
                    trackBy="uuid"
                    variant="container"
                    wrapLines={preferences.wrapLines}
                />
            </ContentLayout>

            {/* Create Patient Modal */}
            <Modal
                onDismiss={() => setShowCreateModal(false)}
                visible={showCreateModal}
                footer={
                    <Box float="right">
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button variant="link" onClick={() => setShowCreateModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleCreatePatient}
                                loading={createLoading}
                                disabled={!isOpenMRSConnected}
                            >
                                Create Patient
                            </Button>
                        </SpaceBetween>
                    </Box>
                }
                header="Create New Patient"
            >
                <Form>
                    <SpaceBetween direction="vertical" size="l">
                        {!isOpenMRSConnected && (
                            <Alert type="warning" statusIconAriaLabel="Warning">
                                OpenMRS connection is required to create patients. Please test the connection first.
                            </Alert>
                        )}
                        <FormField label="Given Name" constraintText="Required">
                            <Input
                                value={newPatient.givenName}
                                onChange={({ detail }) =>
                                    setNewPatient((prev) => ({ ...prev, givenName: detail.value }))
                                }
                                placeholder="Enter given name"
                            />
                        </FormField>

                        <FormField label="Family Name" constraintText="Required">
                            <Input
                                value={newPatient.familyName}
                                onChange={({ detail }) =>
                                    setNewPatient((prev) => ({ ...prev, familyName: detail.value }))
                                }
                                placeholder="Enter family name"
                            />
                        </FormField>

                        <FormField label="Gender" constraintText="Required">
                            <Select
                                selectedOption={
                                    newPatient.gender ? { label: newPatient.gender, value: newPatient.gender } : null
                                }
                                onChange={({ detail }) =>
                                    setNewPatient((prev) => ({ ...prev, gender: detail.selectedOption.value || '' }))
                                }
                                options={[
                                    { label: 'Male', value: 'M' },
                                    { label: 'Female', value: 'F' },
                                    { label: 'Other', value: 'O' },
                                ]}
                                placeholder="Select gender"
                            />
                        </FormField>

                        <FormField label="Birth Date">
                            <Input
                                value={newPatient.birthdate}
                                onChange={({ detail }) =>
                                    setNewPatient((prev) => ({ ...prev, birthdate: detail.value }))
                                }
                                placeholder="YYYY-MM-DD"
                            />
                        </FormField>

                        <FormField label="Patient Identifier" description="Optional - will auto-generate if left blank">
                            <Input
                                value={newPatient.identifier}
                                onChange={({ detail }) =>
                                    setNewPatient((prev) => ({ ...prev, identifier: detail.value }))
                                }
                                placeholder="Enter patient identifier (optional)"
                            />
                        </FormField>
                    </SpaceBetween>
                </Form>
            </Modal>
        </>
    );
}
