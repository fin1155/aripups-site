<?php
// order.php — receive order and forward to Telegram
@session_start();
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/config.php';

// Only POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'message'=>'Метод не разрешён']);
  exit;
}

// Basic header cleanup
foreach (['HTTP_REFERER','HTTP_USER_AGENT'] as $h) {
  if (isset($_SERVER[$h])) $_SERVER[$h] = str_replace(["\r","\n"], '', $_SERVER[$h]);
}

// CSRF check
$csrf = $_POST['csrf_token'] ?? '';
if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf)) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'message'=>'Сессия истекла. Обновите страницу.']);
  exit;
}

// Honeypot
if (!empty($_POST['website'] ?? '')) {
  // silently accept but do nothing
  echo json_encode(['ok'=>true,'message'=>'Спасибо! Если это была ошибка — попробуйте ещё раз.']);
  exit;
}

// Min time check (>= 3s)
$ts = intval($_POST['ts'] ?? 0);
if ($ts > 0 && (microtime(true)*1000 - $ts) < 3000) {
  http_response_code(429);
  echo json_encode(['ok'=>false,'message'=>'Слишком быстро. Попробуйте ещё раз.']);
  exit;
}

// Rate limit per IP (max 5/min, 20/hour)
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$tmp = sys_get_temp_dir();
$minFile = $tmp . '/ap_rate_min_' . md5($ip);
$hourFile = $tmp . '/ap_rate_hour_' . md5($ip);
$now = time();
function hit($file, $window){
  $arr = [];
  if (file_exists($file)) {
    $arr = array_values(array_filter(array_map('intval', explode("\n", file_get_contents($file))), function($t) use($window){
      return $t > (time()-$window);
    }));
  }
  $arr[] = time();
  file_put_contents($file, implode("\n", $arr));
  return count($arr);
}
if (hit($minFile, 60) > 5 || hit($hourFile, 3600) > 20) {
  http_response_code(429);
  echo json_encode(['ok'=>false,'message'=>'Слишком много попыток. Попробуйте позже.']);
  exit;
}

// Validate & normalize fields
function clean_str($s, $max=200){
  $s = trim($s ?? '');
  $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s); // control chars
  $s = strip_tags($s);
  if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
  return $s;
}
$format = clean_str($_POST['format'] ?? '', 100);
$name   = clean_str($_POST['name'] ?? '', 100);
$phone  = clean_str($_POST['phone'] ?? '', 40);
$comment= clean_str($_POST['comment'] ?? '', 600);

// Phone normalize: digits and + only
$phone_norm = preg_replace('/[^0-9+]/', '', $phone);
if (!preg_match('/^\+?\d{7,15}$/', $phone_norm)) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'message'=>'Введите корректный телефон.']);
  exit;
}

if (mb_strlen($name) < 2) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'message'=>'Введите имя.']);
  exit;
}

if (!$format) $format = 'Не выбран';

// OPTIONAL: validate format against assets/programs.csv
$csv = @file_get_contents(__DIR__ . '/../assets/programs.csv');
if ($csv !== false) {
  $lines = explode("\n", $csv);
  array_shift($lines); // header
  $valid = array_map(function($line){
    $cells = str_getcsv($line);
    return isset($cells[1]) ? trim($cells[1]) : null;
  }, $lines);
  $valid = array_filter($valid);
  if ($format !== 'Другое' && !in_array($format, $valid)) {
    // keep, but mark as custom
    $format .= ' (не из списка)';
  }
}

// Build message
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$ref = $_SERVER['HTTP_REFERER'] ?? '';
$txt = "🧁 *AriPups — новая заявка*\n"
     . "• *Формат:* " . $format . "\n"
     . "• *Имя:* " . $name . "\n"
     . "• *Телефон:* " . $phone_norm . "\n"
     . "• *Комментарий:* " . ($comment ?: '—') . "\n"
     . "—\n"
     . "IP: " . $ip . "\n"
     . ($ref ? "Ref: ".$ref."\n" : "");

// Send to Telegram
$api = "https://api.telegram.org/bot{$BOT_TOKEN}/sendMessage";
$payload = http_build_query([
  'chat_id' => $CHAT_ID,
  'text' => $txt,
  'parse_mode' => 'Markdown'
]);
$opts = ['http'=>['method'=>'POST','header'=>"Content-Type: application/x-www-form-urlencoded\r\n",'content'=>$payload,'timeout'=>6]];
$ctx = stream_context_create($opts);
$res = @file_get_contents($api, false, $ctx);
if ($res === false) {
  http_response_code(502);
  echo json_encode(['ok'=>false,'message'=>'Не удалось связаться с Telegram.']);
  exit;
}

echo json_encode(['ok'=>true,'message'=>'Спасибо! Мы получили вашу заявку.']);
