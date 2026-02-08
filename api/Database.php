<?php
/**
 * Database connection singleton using PDO.
 */
class Database {
    private static $pdo = null;

    public static function get() {
        if (self::$pdo === null) {
            $config = require __DIR__ . '/config.php';
            $db = $config['db'];
            $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4";
            self::$pdo = new PDO($dsn, $db['user'], $db['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    /** Execute a prepared statement and return the PDOStatement */
    public static function query($sql, $params = []) {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** Fetch a single row */
    public static function queryOne($sql, $params = []) {
        return self::query($sql, $params)->fetch();
    }

    /** Fetch all rows */
    public static function queryAll($sql, $params = []) {
        return self::query($sql, $params)->fetchAll();
    }

    /** Execute and return the number of affected rows */
    public static function execute($sql, $params = []) {
        return self::query($sql, $params)->rowCount();
    }

    /** Get the last inserted ID */
    public static function lastInsertId() {
        return self::get()->lastInsertId();
    }
}
