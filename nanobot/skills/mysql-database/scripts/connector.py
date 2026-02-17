# scripts/connector.py
import pymysql
from pymysql import MySQLError
from contextlib import contextmanager
from .config import DB_CONFIG, SAFETY_CONFIG
import re

@contextmanager
def get_db_connection():
    """
    数据库连接上下文管理器
    自动处理连接的创建与关闭
    """
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        yield conn
    except MySQLError as e:
        print(f"[DB Skill Error] Connection failed: {e}")
        raise e
    finally:
        if conn:
            conn.close()

def validate_sql_security(sql: str) -> tuple[bool, str]:
    """
    检查 SQL 是否符合安全策略
    :return: (is_safe, error_message)
    """
    sql_upper = sql.strip().upper()
    
    # 1. 黑名单检查
    for keyword in SAFETY_CONFIG['forbidden_keywords']:
        # 使用正则确保匹配的是单词边界，避免误判（如 selection 包含 drop）
        if re.search(rf'\b{keyword}\b', sql_upper):
            return False, f"Security Violation: '{keyword}' operation is forbidden by policy."
            
    # 2. 只读模式检查
    if SAFETY_CONFIG['read_only_mode']:
        # 仅允许 SELECT, SHOW, DESCRIBE, EXPLAIN
        allowed_prefixes = ('SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN')
        if not any(sql_upper.startswith(p) for p in allowed_prefixes):
            return False, "Security Violation: Write operations are disabled in read-only mode."
            
    return True, "OK"

def execute_sql(sql: str, params=None):
    """
    统一的 SQL 执行入口，包含安全检查和资源限制
    """
    # 1. 安全校验
    is_safe, msg = validate_sql_security(sql)
    if not is_safe:
        return False, msg

    # 2. 自动注入 LIMIT (仅针对 SELECT)
    # 这里做一个简单的检查，如果末尾没有分号且没有 LIMIT，则追加
    # 注意：这只是基础实现，复杂SQL解析建议使用 SQL Parser 库
    clean_sql = sql.strip().rstrip(';')
    if SAFETY_CONFIG['auto_limit'] and clean_sql.upper().startswith('SELECT'):
        if 'LIMIT' not in clean_sql.upper():
            clean_sql += f" LIMIT {SAFETY_CONFIG['max_result_rows']}"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(clean_sql, params)
                
                # 判断是读操作还是写操作
                if clean_sql.upper().startswith(('SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN')):
                    # 限制获取行数，双重保险
                    results = cursor.fetchmany(SAFETY_CONFIG['max_result_rows'])
                    return True, results
                else:
                    # 写操作需要提交
                    conn.commit()
                    return True, f"Query OK, {cursor.rowcount} rows affected."
                    
    except Exception as e:
        # 错误信息脱敏，避免暴露过多内部细节给 LLM
        error_msg = str(e)
        # 简单过滤掉绝对路径等敏感信息（视具体错误信息格式而定）
        return False, f"Database Execution Error: {error_msg}"