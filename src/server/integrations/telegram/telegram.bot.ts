import TelegramBotModule from 'node-telegram-bot-api';
import { telegramService } from './telegram.service';

const TelegramBot =
  (TelegramBotModule as any).default || TelegramBotModule;

let telegramBot: any = null;
let isPollingActive = false;
let botStatus: 'ONLINE' | 'POLLING_CONFLICT' | 'SIMULATION_MODE' | 'ERROR' = 'SIMULATION_MODE';
let conflictDetails: string | null = null;
let retryTimeoutId: any = null;

export function getTelegramBotState() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return {
    tokenConfigured: !!token,
    botUsername: '@RSSBK_Surat_Bot',
    status: !token ? 'SIMULATION_MODE' : botStatus,
    isPolling: isPollingActive,
    conflictDetails,
  };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: any = { parse_mode: 'Markdown' }
): Promise<boolean> {
  if (!telegramBot) {
    // If token is configured but bot instance not initialized, try initializing without polling for REST delivery
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        telegramBot = new TelegramBot(token, { polling: false });
      } catch {
        return false;
      }
    } else {
      return false;
    }
  }

  try {
    await telegramBot.sendMessage(chatId, text, options);
    return true;
  } catch (err) {
    console.warn(`Could not send Telegram message to ${chatId}:`, (err as any)?.message || err);
    return false;
  }
}

export async function stopTelegramBot(): Promise<void> {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  if (telegramBot) {
    try {
      if (typeof telegramBot.isPolling === 'function' && telegramBot.isPolling()) {
        await telegramBot.stopPolling({ cancel: true });
      }
    } catch (err) {
      console.warn('⚠️ Error while stopping Telegram polling:', err);
    }
    isPollingActive = false;
  }
}

export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    botStatus = 'SIMULATION_MODE';
    conflictDetails = null;
    console.log('ℹ️ TELEGRAM_BOT_TOKEN tidak ditemukan di environment. Telegram bot beroperasi dalam mode simulasi web.');
    return null;
  }

  // If already polling, don't restart polling
  if (telegramBot && isPollingActive) {
    console.log('⚠️ Telegram Bot sudah berjalan.');
    return telegramBot;
  }

  // Clear previous retry timeout if any
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }

  try {
    if (!telegramBot) {
      telegramBot = new TelegramBot(token, {
        polling: false,
      });

      telegramBot.on('polling_error', async (error: any) => {
        const errMsg = error?.message || '';
        const isConflict = errMsg.includes('409') || errMsg.includes('Conflict') || error?.code === 'ETELEGRAM';

        if (isConflict) {
          botStatus = 'POLLING_CONFLICT';
          conflictDetails = 'Instance bot lain (atau sesi sebelumnya) sedang aktif dengan token ini. Polling dinonaktifkan otomatis untuk mencegah konflik.';
          console.warn('⚠️ Telegram Polling Conflict (409): Instance bot lain sedang menggunakan token ini. Polling dinonaktifkan otomatis. Pengiriman pesan keluar tetap dapat berfungsi.');

          try {
            if (telegramBot && typeof telegramBot.isPolling === 'function' && telegramBot.isPolling()) {
              await telegramBot.stopPolling({ cancel: true });
            }
          } catch {
            // Ignore stop errors
          }
          isPollingActive = false;

          // Schedule a single polite retry in 60s without spamming
          if (!retryTimeoutId) {
            retryTimeoutId = setTimeout(() => {
              retryTimeoutId = null;
              console.log('🔄 Mencoba menghubungkan kembali polling Telegram bot...');
              attemptStartPolling();
            }, 60000);
          }
          return;
        }

        console.error('❌ Telegram polling error:', errMsg);
      });

      telegramBot.on('error', (error: any) => {
        console.error('❌ Telegram bot error:', error?.message || error);
      });

      telegramBot.on('message', async (msg: any) => {
        try {
          const telegramUserId = String(msg.from?.id ?? msg.chat.id);

          const senderName =
            [
              msg.from?.first_name,
              msg.from?.last_name,
            ]
              .filter(Boolean)
              .join(' ') ||
            msg.from?.username ||
            'Telegram User';

          // 1. Handle Document (PDF, images sent as document, etc.)
          if (msg.document) {
            console.log('📎 Telegram Document received from:', telegramUserId, msg.document.file_name);
            try {
              const fileId = msg.document.file_id;
              const fileName = msg.document.file_name || `Dokumen_Surat_${Date.now()}.pdf`;
              const mimeType = msg.document.mime_type || 'application/pdf';

              const fileLink = await telegramBot.getFileLink(fileId);
              const responseFetch = await fetch(fileLink);
              const arrayBuffer = await responseFetch.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              const reply = await telegramService.handleMediaMessage(
                telegramUserId,
                senderName,
                buffer,
                fileName,
                mimeType
              );

              if (reply && reply.trim().length > 0) {
                await telegramBot.sendMessage(msg.chat.id, reply, {
                  parse_mode: 'Markdown',
                });
              }
            } catch (mediaErr: any) {
              console.error('❌ Error processing Telegram document:', mediaErr);
              await telegramBot.sendMessage(
                msg.chat.id,
                `❌ Gagal memproses berkas dokumen: ${mediaErr?.message || 'Format tidak didukung'}`
              );
            }
            return;
          }

          // 2. Handle Photo attachment
          if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            console.log('📷 Telegram Photo received from:', telegramUserId);
            try {
              const bestPhoto = msg.photo[msg.photo.length - 1];
              const fileId = bestPhoto.file_id;
              const fileName = `Foto_Surat_${Date.now()}.jpg`;
              const mimeType = 'image/jpeg';

              const fileLink = await telegramBot.getFileLink(fileId);
              const responseFetch = await fetch(fileLink);
              const arrayBuffer = await responseFetch.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              const reply = await telegramService.handleMediaMessage(
                telegramUserId,
                senderName,
                buffer,
                fileName,
                mimeType
              );

              if (reply && reply.trim().length > 0) {
                await telegramBot.sendMessage(msg.chat.id, reply, {
                  parse_mode: 'Markdown',
                });
              }
            } catch (photoErr: any) {
              console.error('❌ Error processing Telegram photo:', photoErr);
              await telegramBot.sendMessage(
                msg.chat.id,
                `❌ Gagal memproses foto surat: ${photoErr?.message || 'Format tidak didukung'}`
              );
            }
            return;
          }

          // 3. Handle Text message
          const text = msg.text?.trim();

          if (!text) {
            return;
          }

          console.log('📩 Telegram:', {
            chatId: msg.chat.id,
            userId: telegramUserId,
            senderName,
            text,
          });

          const response = await telegramService.handleMessage(
            telegramUserId,
            senderName,
            text
          );

          if (response && response.trim().length > 0) {
            try {
              await telegramBot.sendMessage(
                msg.chat.id,
                response,
                {
                  parse_mode: 'Markdown',
                }
              );
            } catch (sendErr: any) {
              console.error(
                '❌ Telegram Markdown send error:',
                sendErr?.message || sendErr
              );

              // Retry tanpa Markdown
              try {
                await telegramBot.sendMessage(
                  msg.chat.id,
                  response
                );
              } catch (retryErr: any) {
                console.error(
                  '❌ Telegram plain-text send error:',
                  retryErr?.message || retryErr
                );
              }
            }
          }
                  } catch (err: any) {
                    console.error('❌ Telegram message error:', err?.message || err);
                  }
                });
          }

    await attemptStartPolling();
    return telegramBot;
  } catch (err: any) {
    botStatus = 'ERROR';
    console.error('❌ Gagal memulai Telegram bot:', err?.message || err);
    return null;
  }
}

async function attemptStartPolling() {
  if (!telegramBot) return;
  try {
    if (typeof telegramBot.isPolling === 'function' && telegramBot.isPolling()) {
      isPollingActive = true;
      botStatus = 'ONLINE';
      conflictDetails = null;
      return;
    }
    await telegramBot.startPolling();
    isPollingActive = true;
    botStatus = 'ONLINE';
    conflictDetails = null;
    console.log('🤖 Telegram Bot @RSSBK_Surat_Bot polling aktif.');
  } catch (err: any) {
    if (err?.message?.includes('409') || err?.message?.includes('Conflict')) {
      botStatus = 'POLLING_CONFLICT';
      conflictDetails = 'Instance bot lain sedang aktif dengan token ini.';
      console.warn('⚠️ Telegram bot start polling conflict: instance lain sedang berjalan.');
    } else {
      console.warn('⚠️ Telegram bot polling could not start immediately:', err?.message || err);
    }
    isPollingActive = false;
  }
}

// Clean up on process termination
const cleanup = async () => {
  await stopTelegramBot();
};

process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);

