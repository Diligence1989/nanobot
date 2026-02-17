# scripts/actions.py
import json
from .connector import execute_sql

def list_tables():
    """
    列出当前数据库中的所有表。
    """
    sql = "SHOW TABLES"
    success, data = execute_sql(sql)
    
    if success:
        # DictCursor 返回 [{'Tables_in_test_db': 'users'}, ...]
        # 扁平化处理
        table_names = [list(row.values())[0] for row in data]
        return json.dumps({"status": "success", "tables": table_names}, ensure_ascii=False)
    else:
        return json.dumps({"status": "error", "message": data})

def get_table_schema(table_name: str):
    """
    获取指定表的结构。
    """
    # 基础的表名校验，防止注入
    if not table_name.replace('_', '').isalnum():
         return json.dumps({"status": "error", "message": "Invalid table name format."})

    sql = f"DESCRIBE `{table_name}`"
    success, data = execute_sql(sql)
    
    if success:
        return json.dumps(data, ensure_ascii=False, default=str)
    else:
        return json.dumps({"status": "error", "message": data})

def run_sql_query(sql: str):
    """
    执行一条 SQL 查询语句。
    支持 SELECT/INSERT/UPDATE/DELETE。
    """
    if not sql or not isinstance(sql, str):
        return json.dumps({"status": "error", "message": "Invalid SQL input."})

    success, data = execute_sql(sql)
    
    if success:
        return json.dumps({
            "status": "success",
            "data": data,
            "meta": "Results might be limited by safety config."
        }, ensure_ascii=False, default=str) # default=str 处理 datetime/decimal
    else:
        return json.dumps({
            "status": "error",
            "message": data
        })