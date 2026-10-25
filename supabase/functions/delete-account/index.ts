import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

Deno.serve(async (request) => {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN')
  const origin = request.headers.get('Origin')
  if (!allowedOrigin || !origin || origin !== allowedOrigin) {
    return new Response('Origin not allowed', { status: 403 })
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
    })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
    })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
    })
  }

  try {
    const { confirmation } = await request.json()
    if (confirmation !== 'DELETE') {
      return new Response('Explicit deletion confirmation is required', {
        status: 400,
        headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Account deletion is not configured on this deployment.')
    }

    const token = authorization.slice('Bearer '.length)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) {
      return new Response('Your session is no longer valid. Sign in and try again.', {
        status: 401,
        headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: completions, error: completionError } = await adminClient
      .from('task_completions')
      .select('id, photos')
      .eq('user_id', authData.user.id)
    if (completionError) throw completionError

    const evidencePaths = (completions ?? []).flatMap((completion) => completion.photos ?? [])

    const { error: preparationError } = await userClient.rpc('prepare_my_account_deletion')
    if (preparationError) {
      return new Response(preparationError.message, {
        status: 409,
        headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
      })
    }

    if (evidencePaths.length > 0) {
      const { error: storageError } = await adminClient.storage.from('task-evidence').remove(evidencePaths)
      if (storageError) throw storageError
      const { error: clearPhotosError } = await adminClient
        .from('task_completions')
        .update({ photos: [] })
        .eq('user_id', authData.user.id)
      if (clearPhotosError) throw clearPhotosError
    }

    const { error: deletionError } = await adminClient.auth.admin.deleteUser(authData.user.id)
    if (deletionError) throw deletionError

    return Response.json(
      { deleted: true },
      { headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin } },
    )
  } catch (error) {
    console.error('delete-account failed', error)
    return new Response('Account deletion failed. Contact the deployment administrator.', {
      status: 500,
      headers: { ...corsHeaders, 'Access-Control-Allow-Origin': allowedOrigin },
    })
  }
})
