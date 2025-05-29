import React from 'react';

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Grid from '@cloudscape-design/components/grid';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';

const STATUS_SELECTION = [
    { label: 'All', value: 'ALL' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Failed', value: 'FAILED' },
];

const ANALYSIS_TYPE_SELECTION = [
    { label: 'All', value: 'ALL' },
    { label: 'Medical Entities', value: 'ENTITIES' },
    { label: 'ICD-10-CM', value: 'ICD10CM' },
    { label: 'RxNorm', value: 'RXNORM' },
    { label: 'SNOMED CT', value: 'SNOMEDCT' },
];

type DocumentsFilterProps = {
    setSearchParams: React.Dispatch<
        React.SetStateAction<{
            fileName?: string;
            status?: string;
            analysisType?: string;
        }>
    >;
    searchParams: {
        fileName?: string;
        status?: string;
        analysisType?: string;
    };
};

export function DocumentsFilter({ setSearchParams, searchParams }: DocumentsFilterProps) {
    // Update searchParam to id: value
    function handleInputChange(id: string, value: string) {
        setSearchParams((currentSearchParams) => {
            return {
                ...currentSearchParams,
                [id]: value,
            };
        });
    }

    return (
        <Form>
            <Grid gridDefinition={[{ colspan: 4 }, { colspan: 3 }, { colspan: 3 }, { colspan: 2 }]}>
                <Input
                    placeholder="File Name"
                    value={searchParams?.fileName || ''}
                    onChange={({ detail }) => handleInputChange('fileName', detail.value)}
                />
                <Select
                    selectedOption={STATUS_SELECTION.find((s) => s.value === searchParams?.status) || null}
                    onChange={({ detail }) => handleInputChange('status', detail.selectedOption.value || 'ALL')}
                    options={STATUS_SELECTION}
                    placeholder="Status"
                />
                <Select
                    selectedOption={ANALYSIS_TYPE_SELECTION.find((s) => s.value === searchParams?.analysisType) || null}
                    onChange={({ detail }) => handleInputChange('analysisType', detail.selectedOption.value || 'ALL')}
                    options={ANALYSIS_TYPE_SELECTION}
                    placeholder="Analysis Type"
                />
                <Button disabled={Object.keys(searchParams).length === 0} onClick={() => setSearchParams({})}>
                    Clear
                </Button>
            </Grid>
        </Form>
    );
}
