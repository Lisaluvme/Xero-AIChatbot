/**
 * Quick test script to verify GLM connectivity
 */
require('dotenv').config();
const glmClient = require('./glmClient');

async function testGLM() {
  console.log('🧪 Testing GLM-4-Flash connectivity...\n');
  console.log('📋 GLM API URL:', process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
  console.log('🔑 GLM API Key:', process.env.GLM_API_KEY ? `${process.env.GLM_API_KEY.substring(0, 10)}...` : 'NOT SET');
  console.log('');

  const testMessage = 'Hello! Please respond with a simple JSON: {"status": "ok"}';

  try {
    console.log('💬 Sending test message:', testMessage);
    console.log('');

    const response = await glmClient.chatWithGLM(testMessage);

    if (response.success) {
      console.log('✅ GLM API connection successful!\n');
      console.log('📥 Response:', response.content);
      console.log('');
      console.log('📊 Usage:', response.usage);
      console.log('');
      console.log('🔍 Is JSON:', response.isJSON);
      if (response.isJSON) {
        console.log('📦 Parsed JSON:', JSON.stringify(response.parsedJSON, null, 2));
      }
    } else {
      console.log('❌ GLM API connection failed!');
      console.log('🚨 Error:', response.error);
    }
  } catch (error) {
    console.log('❌ Test failed with exception:', error.message);
  }
}

testGLM();
