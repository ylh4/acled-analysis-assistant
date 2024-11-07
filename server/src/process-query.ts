import { queryAI } from './query-ai';
import { query } from './db';
import { prompts, SchemaAnalysisResponse, TriageResponse, ValidateAnswerResponse } from './prompt-templates';

interface QueryResponse {
  response: string;
  timestamp: string;
  queryType: 'GENERAL_QUESTION' | 'DATA_QUESTION' | 'OUT_OF_SCOPE';
}

export async function processQuery(message: string): Promise<QueryResponse> {
  console.log('🚀 Processing query:', message);

  // Step 1: Triage the request
  const { system, user } = prompts.triage(message);
  console.log('📋 Step 1 - Triage prompts:', { system, user });
  const triageResponse = await queryAI(system, user + message, true);
  console.log('📋 Step 1 - Triage AI response:', triageResponse);
  const triageResult = JSON.parse(triageResponse) as TriageResponse;
  console.log('📋 Step 1 - Parsed triage result:', triageResult);
  const queryType = triageResult.queryType;
  
  let response = '';
  
  switch (queryType) {
    case 'GENERAL_QUESTION':
      console.log('💭 Processing general question');
      const generalPrompt = prompts.generalAnswer(message);
      console.log('💭 General prompts:', generalPrompt);
      const generalResponse = await queryAI(generalPrompt.system, generalPrompt.user, true);
      console.log('💭 General AI response:', generalResponse);
      const generalResult = JSON.parse(generalResponse) as { answer: string; examples: string[] };
      console.log('💭 Parsed general result:', generalResult);
      response = generalResult.answer;
      break;
      
    case 'DATA_QUESTION':
      console.log('🔍 Processing data question');
      // Step 3: Get schema information - Updated for SQLite
      const schemaResult = await query('SELECT * FROM TABLE_SCHEMA');
      console.log('📊 Step 3 - Schema query result:', schemaResult);
      const tables = schemaResult.map(row => ({
        tableName: row.table_name,
        analysis: row.analysis
      }));
      console.log('📊 Step 3 - Processed tables:', tables);
      
      // Step 4: Analyze schema and get context for SQL generation
      const schemaPrompt = prompts.schemaAnalysis({ tables }, message);
      console.log('🔎 Step 4 - Schema analysis prompts:', schemaPrompt);
      const schemaAnalysis = await queryAI(schemaPrompt.system, schemaPrompt.user, true);
      console.log('🔎 Step 4 - Schema analysis AI response:', schemaAnalysis);
      const schemaAnalysisResult = JSON.parse(schemaAnalysis) as SchemaAnalysisResponse;
      console.log('🔎 Step 4 - Parsed schema analysis:', schemaAnalysisResult);

      // Add check for inScope
      if (!schemaAnalysisResult.inScope) {
        response = `I apologize, but I cannot answer this question using the available database schema. ${schemaAnalysisResult.outOfScopeReason}`;
        break;
      }

      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let sqlQuery = '';
      let queryResults;
      let validAnswer = false;
      let lastError = '';

      while (attempts < MAX_ATTEMPTS && !validAnswer) {
        attempts++;
        console.log(`📝 Step 5 - SQL generation attempt ${attempts}`);
        
        try {
          // Generate SQL query
          const sqlPrompt = lastError 
            ? prompts.regenerateSQL(schemaAnalysisResult, message, sqlQuery, lastError)
            : prompts.generateSQL(schemaAnalysisResult, message);
          console.log('📝 Step 5 - SQL generation prompts:', sqlPrompt);
          const sqlResponse = await queryAI(sqlPrompt.system, sqlPrompt.user, true);
          console.log('📝 Step 5 - SQL AI response:', sqlResponse);
          sqlQuery = JSON.parse(sqlResponse).query;
          console.log('📝 Step 5 - Final SQL query:', sqlQuery);
          
          // Execute the SQL query - Updated for SQLite
          queryResults = await query(sqlQuery);
          console.log('⚡ Step 6 - Query results:', queryResults);
          
          // Format the response - Updated for SQLite
          const formatPrompt = prompts.formatAnswer(message, sqlQuery, queryResults);
          const formattedResponse = await queryAI(formatPrompt.system, formatPrompt.user, true);
          const formattedResult = JSON.parse(formattedResponse) as { answer: string; highlights: string[]; caveats: string[] };
          
          // Validate the answer
          console.log('🔍 Step 7 - Validating answer');
          const validatePrompt = prompts.validateAnswer(message, formattedResult.answer);
          const validationResponse = await queryAI(validatePrompt.system, validatePrompt.user, true);
          const validationResult = JSON.parse(validationResponse) as ValidateAnswerResponse;
          
          if (validationResult.isAnswered) {
            validAnswer = true;
            response = formattedResult.answer;
          } else {
            lastError = validationResult.reason || 'Answer does not address the question';
            console.log(`⚠️ Answer validation failed: ${lastError}`);
          }
        } catch (error: any) {
          lastError = error.message;
          console.error(`❌ Error in attempt ${attempts}:`, error);
        }
      }

      if (!validAnswer) {
        response = "I apologize, but I was unable to generate a satisfactory answer to your question after multiple attempts. " +
                   "The last error encountered was: " + lastError;
      }
      break;
      
    case 'OUT_OF_SCOPE':
      console.log('⚠️ Query marked as out of scope');
      response = "I apologize, but this question appears to be outside the scope of database-related queries I can help with.";
      break;
  }

  console.log('✅ Final response:', { response, timestamp: new Date().toISOString(), queryType });
  return {
    response,
    timestamp: new Date().toISOString(),
    queryType
  };
} 