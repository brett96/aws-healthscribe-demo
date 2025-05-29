import React, { useEffect } from 'react';

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Grid from '@cloudscape-design/components/grid';
import Input from '@cloudscape-design/components/input';

import { useDebounce } from 'use-debounce';

type PatientsFilterProps = {
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    onSearch: (query: string) => Promise<void>;
    isOpenMRSConnected: boolean;
};

export function PatientsFilter({ searchQuery, setSearchQuery, onSearch, isOpenMRSConnected }: PatientsFilterProps) {
    const [debouncedSearchQuery] = useDebounce<string>(searchQuery, 500);

    // Update search when debounced query changes
    useEffect(() => {
        if (debouncedSearchQuery) {
            onSearch(debouncedSearchQuery).catch(console.error);
        }
    }, [debouncedSearchQuery, onSearch]);

    return (
        <Form>
            <Grid gridDefinition={[{ colspan: 8 }, { colspan: 2 }]}>
                <Input
                    placeholder={
                        isOpenMRSConnected
                            ? 'Search by patient name or identifier'
                            : 'Connect to OpenMRS to search patients'
                    }
                    value={searchQuery}
                    onChange={({ detail }) => setSearchQuery(detail.value)}
                    disabled={!isOpenMRSConnected}
                />
                <Button disabled={!searchQuery} onClick={() => setSearchQuery('')}>
                    Clear
                </Button>
            </Grid>
        </Form>
    );
}
