<?php
// config.php
// Read from .env-style file if present, else constants below.
$BOT_TOKEN = getenv('TELEGRAM_BOT_TOKEN');
$CHAT_ID = getenv('TELEGRAM_CHAT_ID');


// Try to load from .env (project root or php/)
function load_env($path){
  if (!file_exists($path)) return;
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  foreach ($lines as $line){
    if (strpos(ltrim($line), '#') === 0) continue;
    if (!str_contains($line, '=')) continue;
    list($k,$v) = explode('=', $line, 2);
    $k = trim($k); $v = trim($v, " \t\n\r\0\x0B\"'");
    if ($k === 'TELEGRAM_BOT_TOKEN') $GLOBALS['BOT_TOKEN'] = $v;
    if ($k === 'TELEGRAM_CHAT_ID') $GLOBALS['CHAT_ID'] = $v;
  }
}
load_env(__DIR__ . '/../.env');
load_env(__DIR__ . '/.env');

if (!$BOT_TOKEN || !$CHAT_ID) {
  // fallback: load from local config.json if exists
  $cfg_path = __DIR__ . '/config.local.php';
  if (file_exists($cfg_path)) {
    include $cfg_path; // should define $BOT_TOKEN, $CHAT_ID
  }
}


// Try to load from .env (project root or php/)
function load_env($path){
  if (!file_exists($path)) return;
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  foreach ($lines as $line){
    if (strpos(ltrim($line), '#') === 0) continue;
    if (!str_contains($line, '=')) continue;
    list($k,$v) = explode('=', $line, 2);
    $k = trim($k); $v = trim($v, " \t\n\r\0\x0B\"'");
    if ($k === 'TELEGRAM_BOT_TOKEN') $GLOBALS['BOT_TOKEN'] = $v;
    if ($k === 'TELEGRAM_CHAT_ID') $GLOBALS['CHAT_ID'] = $v;
  }
}
load_env(__DIR__ . '/../.env');
load_env(__DIR__ . '/.env');

if (!$BOT_TOKEN || !$CHAT_ID) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok'=>false,'message'=>'Не настроен TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID']);
  exit;
}
?>
