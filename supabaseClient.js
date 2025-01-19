import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Configuration des options Supabase
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 
      'x-application-name': 'CampusPlusApp' 
    }
  },
  db: {
    schema: 'public'
  }
}

// Client standard (utilisateur anonyme)
export const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_ANON_KEY
)

// Fonction de test de connexion
export async function testSupabaseConnection() {
  try {
    // Test de connexion avec un timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const { data, error } = await supabase
      .from('etudiants')
      .select('*', { count: 'exact' })
      .abortSignal(controller.signal)

    clearTimeout(timeoutId)
    
    if (error) {
      console.error('❌ Erreur de connexion :', error)
      return false
    }
    
    console.log('✅ Connexion Supabase réussie')
    console.log(`📊 Nombre d'étudiants : ${data.length}`)
    return true
  } catch (erreur) {
    console.error('🚨 Erreur de connexion détaillée :', {
      message: erreur.message,
      name: erreur.name,
      stack: erreur.stack
    })
    return false
  }
}

// Fonction de gestion des erreurs Supabase
export function handleSupabaseError(error, contexte = 'Opération') {
  console.error(`❌ Erreur ${contexte} :`, {
    code: error.code,
    message: error.message,
    details: error.details
  })

  // Catégorisation des erreurs
  switch (error.code) {
    case 'PGRST116':
      console.warn('Aucun résultat trouvé')
      break
    case '23505':
      console.error('Violation de contrainte unique')
      break
    case '42501':
      console.error('Erreur de permission')
      break
    default:
      console.error('Erreur Supabase non catégorisée')
  }
}

// Fonction utilitaire pour formater les données JSON
export function safeJSONStringify(data) {
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error('❌ Erreur de sérialisation JSON', error)
    return null
  }
}

// Fonction de récupération sécurisée
export async function safeSupabaseQuery(queryFn, contexte = 'Requête') {
  try {
    const result = await queryFn()
    return result
  } catch (error) {
    handleSupabaseError(error, contexte)
    return null
  }
}

// Export des types de rôles
export const ROLES = {
  ETUDIANT: 'etudiant',
  ADMIN: 'admin',
  MODERATEUR: 'moderateur'
}