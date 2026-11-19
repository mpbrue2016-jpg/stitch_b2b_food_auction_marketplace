import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClient,
  isSupabaseServerConfigured,
  mapDbProfileToUserProfile,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  buildAuditHash,
  extractClientIp,
  isValidCnpjDigits,
  isValidCpfDigits,
} from '@/lib/security';
import { formatCnpj, formatCpf, formatPhoneBr } from '@/lib/format';
import type { PerfilComercial, TipoPessoa } from '@/lib/types';

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente do servidor.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const {
      tipoPessoa,
      perfilComercial,
      rolePreferida,
      email,
      password,
      razaoSocial,
      nomeFantasia,
      cpf,
      cnpj,
      telefone,
      cidade,
      uf,
      cep,
      logradouro,
    } = body;

    // Bloqueia terminantemente auto-cadastro administrativo
    if (
      perfilComercial === 'admin' ||
      rolePreferida === 'admin' ||
      body.role === 'admin'
    ) {
      return NextResponse.json(
        {
          error:
            'Acesso de Administrador é exclusivo e controlado internamente. Utilize /login com seu CPF autorizado.',
        },
        { status: 403 }
      );
    }

    const safeTipoPessoa: TipoPessoa = tipoPessoa === 'PF' ? 'PF' : 'PJ';
    const allowedPerfis: PerfilComercial[] = [
      'comprador',
      'fornecedor',
      'anunciante',
      'empresa',
      'pessoa_fisica',
    ];
    const safePerfilComercial: PerfilComercial = allowedPerfis.includes(perfilComercial)
      ? perfilComercial
      : safeTipoPessoa === 'PF'
      ? 'pessoa_fisica'
      : 'empresa';

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanRazao = typeof razaoSocial === 'string' ? razaoSocial.trim() : '';
    const cleanFantasia = typeof nomeFantasia === 'string' ? nomeFantasia.trim() : '';
    const cleanCidade = typeof cidade === 'string' ? cidade.trim() : '';
    const cleanUf = typeof uf === 'string' ? uf.trim().toUpperCase().slice(0, 2) : 'SP';
    const cleanTelefone = typeof telefone === 'string' ? formatPhoneBr(telefone) : '';

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Informe um e-mail corporativo ou pessoal válido.' }, { status: 400 });
    }
    if (cleanPassword.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve conter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }
    if (cleanRazao.length < 3) {
      return NextResponse.json(
        {
          error:
            safeTipoPessoa === 'PF'
              ? 'Informe seu nome completo (mínimo 3 caracteres).'
              : 'Informe a Razão Social da empresa (mínimo 3 caracteres).',
        },
        { status: 400 }
      );
    }
    if (!cleanCidade || cleanUf.length !== 2) {
      return NextResponse.json(
        { error: 'Informe Cidade e UF (2 letras) para logística e emissão fiscal.' },
        { status: 400 }
      );
    }

    let formattedCpf: string | null = null;
    let formattedCnpj: string | null = null;

    if (safeTipoPessoa === 'PF') {
      if (!cpf || !isValidCpfDigits(String(cpf))) {
        return NextResponse.json(
          { error: 'CPF inválido. Verifique os 11 dígitos informados.' },
          { status: 400 }
        );
      }
      formattedCpf = formatCpf(String(cpf));
    } else {
      if (!cnpj || !isValidCnpjDigits(String(cnpj))) {
        return NextResponse.json(
          { error: 'CNPJ inválido. Verifique os 14 dígitos da empresa.' },
          { status: 400 }
        );
      }
      formattedCnpj = formatCnpj(String(cnpj));
      if (cpf && String(cpf).trim()) {
        if (!isValidCpfDigits(String(cpf))) {
          return NextResponse.json(
            { error: 'CPF do responsável legal inválido.' },
            { status: 400 }
          );
        }
        formattedCpf = formatCpf(String(cpf));
      }
    }

    // Mapeia papel oficial no PostgreSQL ENUM ('comprador' | 'fornecedor')
    const resolvedRole: 'comprador' | 'fornecedor' =
      safePerfilComercial === 'fornecedor' ||
      safePerfilComercial === 'anunciante' ||
      (safePerfilComercial === 'empresa' && rolePreferida === 'fornecedor')
        ? 'fornecedor'
        : 'comprador';

    const metadataPayload = {
      role: resolvedRole,
      tipo_pessoa: safeTipoPessoa,
      perfil_comercial: safePerfilComercial,
      cpf: formattedCpf,
      cnpj: formattedCnpj,
      razao_social: cleanRazao.slice(0, 255),
      nome_fantasia: (cleanFantasia || cleanRazao).slice(0, 255),
      telefone: cleanTelefone || null,
      cidade: cleanCidade.slice(0, 100),
      uf: cleanUf,
      cep: typeof cep === 'string' ? cep.trim().slice(0, 10) : null,
      logradouro: typeof logradouro === 'string' ? logradouro.trim().slice(0, 255) : null,
    };

    let createdUserId: string | null = null;

    if (isSupabaseAdminConfigured) {
      const admin = createAdminSupabaseClient();

      // Verifica duplicidade de documento antes de criar no Auth
      if (formattedCnpj) {
        const { data: existingCnpj } = await admin
          .from('profiles')
          .select('id')
          .eq('cnpj', formattedCnpj)
          .maybeSingle();
        if (existingCnpj) {
          return NextResponse.json(
            { error: 'Já existe uma conta oficial cadastrada com este CNPJ.' },
            { status: 409 }
          );
        }
      }
      if (formattedCpf && safeTipoPessoa === 'PF') {
        const { data: existingCpf } = await admin
          .from('profiles')
          .select('id')
          .eq('cpf', formattedCpf)
          .maybeSingle();
        if (existingCpf) {
          return NextResponse.json(
            { error: 'Já existe uma conta oficial cadastrada com este CPF.' },
            { status: 409 }
          );
        }
      }

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: metadataPayload,
      });

      if (authErr || !authData.user) {
        const msg = authErr?.message?.toLowerCase() || '';
        if (msg.includes('already') || msg.includes('registered')) {
          return NextResponse.json(
            { error: 'Este e-mail já está cadastrado no Varejista Online.' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: authErr?.message || 'Não foi possível criar sua conta oficial.' },
          { status: 400 }
        );
      }

      createdUserId = authData.user.id;

      const profileInsert: Record<string, unknown> = {
        id: createdUserId,
        email: cleanEmail,
        role: resolvedRole,
        tipo_pessoa: safeTipoPessoa,
        perfil_comercial: safePerfilComercial,
        is_demo: false,
        cpf: formattedCpf,
        cnpj: formattedCnpj,
        razao_social: metadataPayload.razao_social,
        nome_fantasia: metadataPayload.nome_fantasia,
        telefone: metadataPayload.telefone,
        cidade: metadataPayload.cidade,
        uf: metadataPayload.uf,
        cep: metadataPayload.cep,
        logradouro: metadataPayload.logradouro,
        limite_credito_escrow: resolvedRole === 'comprador' ? 50000 : 0,
        status_aprovacao: 'aprovado',
      };

      let { data: profileRow, error: profileErr } = await admin
        .from('profiles')
        .upsert(profileInsert, { onConflict: 'id' })
        .select('*')
        .single();

      // Fallback caso a migration 20261120000000 ainda não tenha sido aplicada no DB
      if (profileErr && profileErr.code === '42703') {
        delete profileInsert.tipo_pessoa;
        delete profileInsert.perfil_comercial;
        delete profileInsert.is_demo;
        if (!profileInsert.cnpj) {
          profileInsert.cnpj = formattedCpf || `PF-${createdUserId.slice(0, 10).toUpperCase()}`;
        }
        const retry = await admin
          .from('profiles')
          .upsert(profileInsert, { onConflict: 'id' })
          .select('*')
          .single();
        profileRow = retry.data;
        profileErr = retry.error;
      }

      if (profileErr || !profileRow) {
        return NextResponse.json(
          {
            error:
              profileErr?.message ||
              'Conta criada no Auth, mas houve erro ao inicializar perfil no banco.',
          },
          { status: 500 }
        );
      }

      // Log de auditoria WORM (não bloqueante)
      try {
        await admin.from('audit_worm_logs').insert({
          tipo_evento: 'cadastro_oficial_criado',
          protocolo: `CAD-${createdUserId.slice(0, 8).toUpperCase()}`,
          payload_json: {
            userId: createdUserId,
            role: resolvedRole,
            tipoPessoa: safeTipoPessoa,
            perfilComercial: safePerfilComercial,
            isDemo: false,
            ip: extractClientIp(req),
          },
          merkle_root_hash: buildAuditHash(createdUserId, 'cadastro_oficial_criado', {
            role: resolvedRole,
            tipoPessoa: safeTipoPessoa,
          }),
          responsavel_id: createdUserId,
        });
      } catch {
        // Ignora erro secundário de auditoria
      }

      const mappedProfile = mapDbProfileToUserProfile(profileRow as Record<string, unknown>);
      const redirectTo =
        resolvedRole === 'fornecedor'
          ? '/painel/fornecedor?env=original&welcome=1'
          : '/painel/comprador?env=original&welcome=1';

      return NextResponse.json(
        {
          message:
            'Cadastro oficial concluído com sucesso! Seu ambiente exclusivo está pronto para uso.',
          profile: mappedProfile,
          redirectTo,
        },
        { status: 201 }
      );
    }

    // Fallback sem service_role: utiliza signUp padrão do Supabase
    const supabase = createServerSupabaseClient();
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: { data: metadataPayload },
    });

    if (signUpErr || !signUpData.user) {
      return NextResponse.json(
        { error: signUpErr?.message || 'Erro ao concluir cadastro oficial.' },
        { status: 400 }
      );
    }

    if (signUpData.session) {
      const profileFallback: Record<string, unknown> = {
        id: signUpData.user.id,
        email: cleanEmail,
        role: resolvedRole,
        tipo_pessoa: safeTipoPessoa,
        perfil_comercial: safePerfilComercial,
        is_demo: false,
        cpf: formattedCpf,
        cnpj: formattedCnpj,
        razao_social: metadataPayload.razao_social,
        nome_fantasia: metadataPayload.nome_fantasia,
        telefone: metadataPayload.telefone,
        cidade: metadataPayload.cidade,
        uf: metadataPayload.uf,
        cep: metadataPayload.cep,
        logradouro: metadataPayload.logradouro,
        limite_credito_escrow: resolvedRole === 'comprador' ? 50000 : 0,
        status_aprovacao: 'aprovado',
      };

      const { error: pErr } = await supabase
        .from('profiles')
        .upsert(profileFallback, { onConflict: 'id' });
      if (pErr && pErr.code === '42703') {
        delete profileFallback.tipo_pessoa;
        delete profileFallback.perfil_comercial;
        delete profileFallback.is_demo;
        if (!profileFallback.cnpj) {
          profileFallback.cnpj =
            formattedCpf || `PF-${signUpData.user.id.slice(0, 10).toUpperCase()}`;
        }
        await supabase.from('profiles').upsert(profileFallback, { onConflict: 'id' });
      }
    }

    const redirectTo =
      resolvedRole === 'fornecedor'
        ? '/painel/fornecedor?env=original&welcome=1'
        : '/painel/comprador?env=original&welcome=1';

    return NextResponse.json(
      {
        message: 'Conta criada no Ambiente Original! Seu perfil oficial está ativo.',
        userId: signUpData.user.id,
        redirectTo,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro em POST /api/auth/cadastro:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar cadastro oficial.' },
      { status: 500 }
    );
  }
}
