# scripts/config.py
import pymysql
import os

# 数据库连接配置 (使用 Unix Socket 认证，无需密码)
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '',
    'database': 'test_db',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    'connect_timeout': 5,  # 连接超时限制
    'unix_socket': '/var/run/mysqld/mysqld.sock'  # Unix Socket 认证路径
}

# 安全策略配置
SAFETY_CONFIG = {
    # 是否开启只读模式 (True: 仅允许 SELECT/DESC/SHOW, False: 允许 INSERT/UPDATE/DELETE)
    # 生产环境建议设为 True，或使用只读权限的数据库用户
    'read_only_mode': True,
    
    # 允许执行的最大行数 (防止 SELECT * FROM huge_table 导致 OOM)
    'max_result_rows': 1000,
    
    # 是否自动注入 LIMIT (如果检测到 SELECT 语句没有 LIMIT，自动追加)
    'auto_limit': True,
    
    # 黑名单关键词 (防止破坏性操作)
    'forbidden_keywords': ['DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'SHUTDOWN', 'DELETE', 'INSERT']
}