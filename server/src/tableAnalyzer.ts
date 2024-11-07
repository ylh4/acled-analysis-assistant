import { query } from './db';
import { queryAI } from './query-ai';

async function generateLLMSummary(dataDictionary: Record<string, any>): Promise<Record<string, string>> {
  const systemPrompt = `You are a data analyst tasked with providing concise but complete descriptions of data fields. Include data type and notable information about sample values where relevant. Be brief but ensure every field is described.`;

  const userPrompt = `Given the following data dictionary, provide a description for each field:

${JSON.stringify(dataDictionary, null, 2)}

Format your response as a JSON object where keys are field names and values are descriptions.`;

  const response = await queryAI(systemPrompt, userPrompt, true);
  return JSON.parse(response);
}

export async function analyzeTable(
  tableName: string,
  sampleSize: number = 1000,
  maxDistinctValues: number = 100
): Promise<Record<string, any>> {
  try {
    // Get table schema information
    const schemaInfo = await query(`PRAGMA table_info("${tableName}")`);
    
    // Get sample data
    const sampleQuery = `
      SELECT * FROM "${tableName}" 
      ORDER BY RANDOM() 
      LIMIT ${sampleSize}
    `;
    const sampleData = await query(sampleQuery);

    const columns = schemaInfo.map((col: any) => col.name);
    const dataDictionary: Record<string, any> = {};

    for (const column of columns) {
      const columnInfo = schemaInfo.find((col: any) => col.name === column);
      const columnData = sampleData.map((row: any) => row[column]);
      const distinctValues = new Set(columnData);
      const nullCount = columnData.filter(value => value === null).length;

      dataDictionary[column] = {
        type: getSqliteType(columnInfo?.type || ''),
        distinctCount: distinctValues.size,
        nullCount,
        nullPercentage: (nullCount / sampleSize) * 100,
      };

      if (distinctValues.size <= maxDistinctValues) {
        const valueCounts = columnData.reduce((acc: Record<string, number>, value: any) => {
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        }, {});

        dataDictionary[column].topValues = Object.entries(valueCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([value, count]) => ({ value, count }));
      }

      // Handle numeric columns
      if (getSqliteType(columnInfo?.type) === 'number') {
        const numericValues = columnData.filter(value => value !== null).map(Number);
        if (numericValues.length > 0) {
          dataDictionary[column].min = Math.min(...numericValues);
          dataDictionary[column].max = Math.max(...numericValues);
        }
      }
      // Handle date/timestamp columns
      else if (getSqliteType(columnInfo?.type) === 'date') {
        const dateValues = columnData
          .filter(value => value !== null)
          .map(value => new Date(value))
          .filter(date => !isNaN(date.getTime()));
          
        if (dateValues.length > 0) {
          dataDictionary[column].min = new Date(Math.min(...dateValues.map(date => date.getTime())));
          dataDictionary[column].max = new Date(Math.max(...dateValues.map(date => date.getTime())));
        }
      }
    }

    const llmSummary = await generateLLMSummary(dataDictionary);
    console.log(llmSummary);
    return llmSummary;

  } catch (error) {
    console.error('Error analyzing table:', error);
    throw new Error('Failed to analyze table');
  }
}

function getSqliteType(sqliteType: string): string {
  const type = sqliteType.toUpperCase();
  
  if (type.includes('INT') || type.includes('REAL') || type.includes('NUMERIC') || type.includes('DECIMAL')) {
    return 'number';
  }
  if (type.includes('DATE') || type.includes('TIME')) {
    return 'date';
  }
  if (type.includes('CHAR') || type.includes('TEXT') || type.includes('CLOB')) {
    return 'text';
  }
  if (type.includes('BOOL')) {
    return 'boolean';
  }
  return 'unknown';
}