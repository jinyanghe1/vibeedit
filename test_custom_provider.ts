
import { LLMService } from './src/services/llmService';
import { LLMConfig } from './src/types';

// Mock fetch globally
const globalAny: any = global;
globalAny.fetch = async (url: string, init: any) => {
  console.log(`[MockFetch] Called with URL: '${url}'`);
  return {
    ok: true,
    json: async () => ({
        choices: [{ message: { content: 'mock response' } }]
    })
  };
};

async function testCustomProvider() {
  console.log('--- Testing Custom Provider with Empty URL ---');

  const config: LLMConfig = {
    provider: 'custom',
    apiKey: 'test-key',
    apiUrl: '', // Empty string as simulation of user input
    model: ''
  };

  const service = new LLMService(config);
  
  // Access private config to verify
  const internalConfig = (service as any).config;
  console.log(`Internal config.apiUrl: '${internalConfig.apiUrl}'`);
  
  if (internalConfig.apiUrl === '') {
      console.log('FAIL: internal config.apiUrl is empty string!');
  } else {
      console.log('PASS: internal config.apiUrl is NOT empty.');
  }

  // Try calling the service to see what fetch receives
  try {
    console.log('Calling analyzeScript...');
    // analyzeScript calls callLLM -> callCustom
    await (service as any).analyzeScript('some script'); 
  } catch (error) {
    console.error('Error during call:', error);
  }
}

testCustomProvider().catch(console.error);
