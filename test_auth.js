const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  const testEmail = `test_${Date.now()}@test.com`;
  
  console.log(`1. Signing up with ${testEmail}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'password123'
  });

  if (authError) {
    console.error("SignUp Error:", authError);
    return;
  }
  
  console.log("Signup success! User ID:", authData.user.id);
  
  console.log("2. Attempting to upsert profile...");
  const { data: profile, error: profileError } = await supabase.from('profiles').upsert({
    id: authData.user.id,
    name: 'Test Setup User',
    phone: '1234567890',
    role: 'user'
  }).select().single();
  
  if (profileError) {
    console.error("Profile Upsert Error:", profileError);
    return;
  }
  
  console.log("Profile Upsert Success!", profile);
  
  console.log("3. Testing login...");
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'password123' // Simulate standard pass
  });
  
  if (loginError) {
      console.error("Login Error:", loginError);
      return;
  }
  
  console.log("Login Success! Checking profile row...");
  
  const { data: profData, error: profError } = await supabase.from('profiles').select('*').eq('id', loginData.user.id).single();
  console.log("Fetch profile error:", profError);
  console.log("Fetch profile data:", profData);
}

testAuth();
