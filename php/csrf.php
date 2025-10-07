<?php
// csrf.php — issues a CSRF token
@session_start();
if (empty($_SESSION['csrf_token'])) {
  $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['token' => $_SESSION['csrf_token']]);
