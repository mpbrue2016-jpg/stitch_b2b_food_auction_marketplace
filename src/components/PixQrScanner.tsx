'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface PixQrScannerProps {
  onScanSuccess: (decodedPayload: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

function isValidPixPayload(raw: string): boolean {
  const value = raw.trim();
  if (value.length < 8) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes('br.gov.bcb.pix') ||
    lower.includes('varejistaonline.com.br') ||
    lower.startsWith('000201') ||
    lower.includes('pix') ||
    lower.includes('escrow') ||
    lower.startsWith('e2e') ||
    value.length >= 16
  );
}

export const PixQrScanner: React.FC<PixQrScannerProps> = ({
  onScanSuccess,
  onClose,
  disabled = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanAttemptRef = useRef<number>(0);
  const handledRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [decodingImage, setDecodingImage] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  const handleDetectedCode = useCallback(
    (rawValue: string) => {
      if (handledRef.current || disabled) return;
      if (!isValidPixPayload(rawValue)) {
        setScannerError(
          'QR Code detectado, mas não corresponde a um comprovante ou chave PIX Escrow válida.'
        );
        return;
      }
      handledRef.current = true;
      stopCamera();
      onScanSuccess(rawValue.trim());
    },
    [disabled, onScanSuccess, stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || handledRef.current) {
      return;
    }

    const now = performance.now();
    if (
      video.readyState === video.HAVE_ENOUGH_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      now - lastScanAttemptRef.current >= 140
    ) {
      lastScanAttemptRef.current = now;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (decoded?.data) {
          handleDetectedCode(decoded.data);
          return;
        }
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetectedCode]);

  const startCamera = useCallback(async () => {
    if (disabled) return;
    setScannerError(null);
    handledRef.current = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        'Câmera indisponível neste navegador. Envie a imagem/print do QR Code do comprovante PIX abaixo.'
      );
      return;
    }

    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraStarting(false);
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      stopCamera();
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setScannerError(
          'Permissão de câmera negada. Libere o acesso no navegador ou selecione a imagem do comprovante PIX.'
        );
      } else {
        setScannerError(
          'Nenhuma câmera ativa detectada. Faça o upload da captura/foto do comprovante PIX abaixo.'
        );
      }
    }
  }, [disabled, scanFrame, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    setScannerError(null);
    setDecodingImage(true);
    handledRef.current = false;

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = objectUrl;
      });

      const canvas = canvasRef.current || document.createElement('canvas');
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setScannerError('Não foi possível inicializar o leitor de imagem QR.');
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (decoded?.data) {
        handleDetectedCode(decoded.data);
      } else {
        setScannerError(
          'Nenhum QR Code legível encontrado na imagem. Envie um print nítido contendo o QR Code PIX.'
        );
      }
    } catch {
      setScannerError('Formato de imagem inválido. Utilize PNG, JPG ou WEBP.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setDecodingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border-2 border-primary/30 p-3.5 space-y-3 text-left shadow-inner">
      <div className="flex items-center justify-between border-b border-surface-container pb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[18px]">qr_code_scanner</span>
          <span className="font-extrabold text-xs text-on-surface">
            Leitor Automático de Comprovante PIX
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-on-surface-variant hover:text-on-surface text-xs font-bold flex items-center gap-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          <span>Fechar</span>
        </button>
      </div>

      {/* Live Video Preview with Reticle */}
      <div className="relative aspect-[4/3] w-full rounded-xl bg-inverse-surface overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {cameraActive ? (
          <>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-44 h-44 border-2 border-secondary rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-secondary animate-pulse" />
              </div>
            </div>
            <div className="absolute bottom-2 inset-x-2 text-center">
              <span className="inline-flex items-center gap-1.5 bg-black/75 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                Aponte para o QR Code — confirmação automática instantânea
              </span>
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-white/85 space-y-2">
            <span className="material-symbols-outlined text-3xl text-secondary-fixed">
              {cameraStarting ? 'progress_activity' : 'photo_camera'}
            </span>
            <p className="text-[11px] leading-snug max-w-[240px] mx-auto">
              {cameraStarting
                ? 'Iniciando câmera para leitura automática do QR Code...'
                : 'Use a imagem do comprovante PIX abaixo ou reative a câmera.'}
            </p>
            {!cameraStarting && (
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-container transition-colors"
              >
                Tentar Câmera Novamente
              </button>
            )}
          </div>
        )}
      </div>

      {scannerError && (
        <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-[11px] font-semibold leading-snug">
          {scannerError}
        </div>
      )}

      {/* Receipt Image Fallback */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          type="button"
          disabled={decodingImage || disabled}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
          <span>
            {decodingImage
              ? 'Decodificando QR Code do comprovante...'
              : 'Ler QR Code de Imagem / Print do Comprovante PIX'}
          </span>
        </button>
      </div>
    </div>
  );
};
