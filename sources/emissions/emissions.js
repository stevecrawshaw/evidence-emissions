// sources/emissions/emissions.js

// IMPORTANT: Ensure NO backticks (`) or ${...} syntax are used ANYWHERE below.
// Use comma-separation for all console.log/console.error
// Use string concatenation (' + variable) for error messages

console.log('[emissions] Script starting execution.');

// Define the async function that fetches and returns the data array
const fetchData = async () => {
    var baseUrl = 'https://opendata.westofengland-ca.gov.uk/api/explore/v2.1/catalog/datasets/ca_la_ghg_emissions_sub_sector_ods_vw/exports/json';

    // Server-side ODSQL aggregation: collapse sub-sector + greenhouse-gas rows down
    // to one row per (local authority, year, sector). 'Large Industrial Installations'
    // is NOT a duplicate of Industry's other sub-sectors, despite appearances -- per
    // DESNZ's technical report, the largest gas/electricity consumers are deliberately
    // stripped out of Industry Gas/Electricity/'Other' for non-disclosure reasons and
    // their emissions reported separately under this sub-sector instead. Excluding it
    // (as this source previously did) undercounts Industry emissions by up to ~15% for
    // LAs with large industrial sites (e.g. South Gloucestershire), so it stays included.
    var select = "local_authority_code,local_authority,cauthcd,cauthnm,date_format(calendar_year,'yyyy') as calendar_year,la_ghg_sector as sector,sum(territorial_emissions_kt_co2e) as emissions_kt_co2e,avg(midyear_population_thousands) as population_000s";
    var groupBy = "local_authority_code,local_authority,cauthcd,cauthnm,calendar_year,la_ghg_sector";

    var params = new URLSearchParams();
    params.set('select', select);
    params.set('group_by', groupBy);

    var url = baseUrl + '?' + params.toString();
    console.log('[emissions] fetchData: Starting fetch from URL:', url);

    try {
        const response = await fetch(url);
        const status = response.status;
        console.log('[emissions] fetchData: Response status:', status);

        if (!response.ok) {
            let errorText = 'Could not retrieve error text.';
            try {
                if (response && typeof response.text === 'function') {
                    errorText = await response.text();
                }
            } catch (textError) {
                console.error('[emissions] fetchData: Error getting text from error response:', textError);
            }
            throw new Error('HTTP error! status: ' + status + '. Body: ' + errorText);
        }

        const jsonData = await response.json();
        console.log('[emissions] fetchData: JSON data parsed.');

        if (Array.isArray(jsonData)) {
            console.log('[emissions] fetchData: Data is array. Length:', jsonData.length);
            // calendar_year comes back from date_format() as a string (e.g. "2024");
            // coerce to a number so downstream SQL can do direct arithmetic on it
            // (e.g. MAX(calendar_year) - 10), matching the old integer-year source.
            var coerced = jsonData.map(function (row) {
                row.calendar_year = Number(row.calendar_year);
                return row;
            });
            return coerced;
        } else {
            console.error('[emissions] fetchData: Unexpected JSON structure (expected array):', jsonData);
            throw new Error('Expected a JSON array, received other type.');
        }

    } catch (error) {
        console.error('[emissions] fetchData: Error during async operation:', error.message);
        throw error;
    }
};

console.log('[emissions] Preparing for top-level await...');
let data;
try {
    data = await fetchData();
    console.log('[emissions] Top-level await successful. Data variable is now assigned.');
} catch (tla_error) {
    console.error('[emissions] Top-level await failed:', tla_error.message);
    throw new Error('Failed to fetch data for source emissions: ' + tla_error.message);
}

export { data };

console.log('[emissions] Script initial execution finished. Data exported.');
