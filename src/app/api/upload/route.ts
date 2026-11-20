import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';

const ALLOWED_BUCKETS = new Set(['kyc-docs', 'lot-images', 'banners']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase Storage não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória para envio de arquivos.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let bucket = 'lot-images';
    let docType = 'outro';
    let fileName = `arquivo-${Date.now()}.webp`;
    let mimeType = 'image/webp';
    let fileBuffer: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      bucket = String(formData.get('bucket') || 'lot-images');
      docType = String(formData.get('tipoDocumento') || 'outro');

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
      }
      fileName = file.name || fileName;
      mimeType = file.type || mimeType;
      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } else {
      const body = await req.json();
      bucket = String(body.bucket || 'lot-images');
      docType = String(body.tipoDocumento || 'outro');
      const dataUrl = String(body.dataUrl || '');
      fileName = String(body.fileName || fileName);

      const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return NextResponse.json({ error: 'Formato base64 inválido para upload.' }, { status: 400 });
      }
      mimeType = match[1];
      fileBuffer = Buffer.from(match[2], 'base64');
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: 'Bucket de armazenamento inválido.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.' },
        { status: 400 }
      );
    }

    if (bucket !== 'kyc-docs' && mimeType === 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF permitido apenas no bucket kyc-docs.' },
        { status: 400 }
      );
    }

    const maxBytes = bucket === 'kyc-docs' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (fileBuffer.byteLength > maxBytes) {
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${Math.round(maxBytes / 1024 / 1024)}MB.` },
        { status: 400 }
      );
    }

    // RBAC por bucket
    const isAdmin = isAuthorizedAdminProfile(ctx.profile);
    if (bucket === 'banners' && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas o Administrador Master autorizado pode enviar banners.' },
        { status: 403 }
      );
    }
    if (
      bucket === 'lot-images' &&
      ctx.profile.role !== 'fornecedor' &&
      !isAdmin
    ) {
      return NextResponse.json(
        { error: 'Apenas fornecedores ou administradores podem publicar imagens de lotes.' },
        { status: 403 }
      );
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const storagePath = `${ctx.user.id}/${Date.now()}-${sanitizedName}`;

    const storageClient = isSupabaseAdminConfigured
      ? createAdminSupabaseClient()
      : ctx.supabase;

    const { error: uploadError } = await storageClient.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro no upload Supabase Storage:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Falha ao salvar arquivo no Storage.' },
        { status: 500 }
      );
    }

    if (bucket === 'kyc-docs') {
      const validDocType = [
        'contrato_social',
        'alvara_sanitario',
        'cartao_cnpj',
        'laudo_anvisa',
        'outro',
      ].includes(docType)
        ? docType
        : 'outro';

      await storageClient.from('user_documents').insert({
        user_id: ctx.user.id,
        tipo_documento: validDocType,
        nome_arquivo: sanitizedName,
        storage_path: storagePath,
        mime_type: mimeType,
        tamanho_bytes: fileBuffer.byteLength,
        status_validacao: 'em_analise',
      });

      const { data: signedData } = await storageClient.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600);

      return NextResponse.json(
        {
          bucket,
          storagePath,
          url: signedData?.signedUrl || storagePath,
        },
        { status: 201 }
      );
    }

    const { data: publicUrlData } = storageClient.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return NextResponse.json(
      {
        bucket,
        storagePath,
        url: publicUrlData.publicUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Erro em POST /api/upload:', err);
    return NextResponse.json({ error: 'Erro interno no upload.' }, { status: 500 });
  }
}
