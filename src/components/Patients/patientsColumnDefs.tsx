// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import { Link } from 'react-router-dom';

import Badge from '@cloudscape-design/components/badge';
import TextContent from '@cloudscape-design/components/text-content';

import { Patient } from '@/types/Patient';

function PatientName(patient: Patient) {
    return (
        <TextContent>
            <Link to={`/patient/${patient.uuid}`}>{patient.person.names[0]?.display || patient.display}</Link>
        </TextContent>
    );
}

function PatientIdentifier(patient: Patient) {
    const primaryIdentifier = patient.identifiers?.[0];
    return primaryIdentifier ? primaryIdentifier.identifier : '-';
}

function PatientGender(patient: Patient) {
    const gender = patient.person.gender;
    const colorMap: Record<string, 'blue' | 'green' | 'grey'> = {
        M: 'blue',
        F: 'green',
        O: 'grey',
    };

    const labelMap: Record<string, string> = {
        M: 'Male',
        F: 'Female',
        O: 'Other',
    };

    return <Badge color={colorMap[gender] || 'grey'}>{labelMap[gender] || gender}</Badge>;
}

export const columnDefs = [
    {
        id: 'name',
        header: 'Name',
        cell: (patient: Patient) => PatientName(patient),
        sortingField: 'person.names[0].display',
        width: 250,
    },
    {
        id: 'identifier',
        header: 'Identifier',
        cell: (patient: Patient) => PatientIdentifier(patient),
        sortingField: 'identifiers[0].identifier',
        width: 150,
    },
    {
        id: 'gender',
        header: 'Gender',
        cell: (patient: Patient) => PatientGender(patient),
        sortingField: 'person.gender',
        width: 100,
    },
    {
        id: 'age',
        header: 'Age',
        cell: (patient: Patient) => patient.person.age || '-',
        sortingField: 'person.age',
        width: 80,
    },
    {
        id: 'birthdate',
        header: 'Birth Date',
        cell: (patient: Patient) => patient.person.birthdate || '-',
        sortingField: 'person.birthdate',
        width: 120,
    },
    {
        id: 'address',
        header: 'Address',
        cell: (patient: Patient) => patient.person.addresses?.[0]?.display || '-',
        sortingField: 'person.addresses[0].display',
    },
];
