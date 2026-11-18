import { NextRequest, NextResponse } from 'next/server';
import { isValidCnpjDigits } from '@/lib/security';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCnpj = searchParams.get('cnpj') || '';
  const digits = rawCnpj.replace(/\D/g, '');

  if (digits.length !== 14) {
    return NextResponse.json(
      { error: 'CNPJ incompleto. Informe os 14 dígitos para consulta na Receita Federal.' },
      { status: 400 }
    );
  }

  if (!isValidCnpjDigits(digits)) {
    return NextResponse.json(
      { error: 'Dígito verificador de CNPJ inválido. Verifique os números digitados.' },
      { status: 400 }
    );
  }

  // 1. Consulta primária: BrasilAPI (Receita Federal)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const situacao = String(data.descricao_situacao_cadastral || 'ATIVA').toUpperCase();
      return NextResponse.json({
        source: 'receita_federal_brasilapi',
        verified: situacao === 'ATIVA',
        cnpj: digits,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || data.razao_social || '',
        cnae:
          data.cnae_fiscal && data.cnae_fiscal_descricao
            ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`
            : '',
        cidade: data.municipio || '',
        uf: data.uf || '',
        situacaoCadastral: situacao,
      });
    }
    if (res.status === 404) {
      return NextResponse.json(
        { error: 'CNPJ não encontrado na base oficial da Receita Federal.' },
        { status: 404 }
      );
    }
  } catch {
    // Fallback para ReceitaWS
  }

  // 2. Consulta secundária: ReceitaWS
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ERROR') {
        return NextResponse.json(
          { error: data.message || 'CNPJ não localizado na Receita Federal.' },
          { status: 404 }
        );
      }
      const situacao = String(data.situacao || 'ATIVA').toUpperCase();
      const primaryActivity = Array.isArray(data.atividade_principal)
        ? data.atividade_principal[0]
        : null;
      return NextResponse.json({
        source: 'receita_federal_receitaws',
        verified: situacao === 'ATIVA',
        cnpj: digits,
        razaoSocial: data.nome || '',
        nomeFantasia: data.fantasia || data.nome || '',
        cnae: primaryActivity ? `${primaryActivity.code} - ${primaryActivity.text}` : '',
        cidade: data.municipio || '',
        uf: data.uf || '',
        situacaoCadastral: situacao,
      });
    }
  } catch {
    // Ambos provedores indisponíveis
  }

  return NextResponse.json(
    {
      error:
        'Consulta cadastral na Receita Federal temporariamente indisponível. Verifique sua conexão e tente novamente.',
    },
    { status: 503 }
  );
}
