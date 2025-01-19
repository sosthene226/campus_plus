// config.js
export default {
  port: process.env.PORT || 3333,
  environment: process.env.NODE_ENV || 'development',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  
  // Fonction pour obtenir un utilisateur de test (si nécessaire)
  getTestUser() {
    return {
      id: process.env.TEST_USER_ID || 'test-user-id',
      email: process.env.TEST_USER_EMAIL || 'test@example.com'
    };
  }
}