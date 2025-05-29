// Shared Patient type definition for OpenMRS integration
export interface Patient {
    uuid: string;
    display: string;
    identifiers: Array<{
        identifier: string;
        identifierType: {
            display: string;
        };
    }>;
    person: {
        display: string;
        gender: string;
        age: number;
        birthdate: string;
        names: Array<{
            givenName: string;
            familyName: string;
            display: string;
        }>;
        addresses: Array<{
            display: string;
            cityVillage: string;
            stateProvince: string;
            country: string;
        }>;
    };
    voided: boolean;
}
