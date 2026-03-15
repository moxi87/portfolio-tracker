#!/usr/bin/env python3
"""
Portfolio Pro API 服务
为前端提供真实股票数据
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from data_service import StockDataService, PortfolioCalculator
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # 允许跨域

# 初始化数据服务
data_service = StockDataService()
calculator = PortfolioCalculator(data_service)

@app.route('/')
def index():
    return jsonify({
        'service': 'Portfolio Pro API',
        'version': '1.0',
        'status': 'running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/stock/<code>')
def get_stock(code):
    """获取单只股票实时数据"""
    data = data_service.get_stock_data(code)
    if data:
        return jsonify({
            'success': True,
            'data': data
        })
    return jsonify({
        'success': False,
        'error': 'Data not available'
    }), 404

@app.route('/api/stocks')
def get_stocks():
    """批量获取股票数据"""
    codes = request.args.get('codes', '').split(',')
    codes = [c.strip() for c in codes if c.strip()]
    
    if not codes:
        return jsonify({
            'success': False,
            'error': 'No stock codes provided'
        }), 400
    
    results = data_service.get_batch_data(codes)
    return jsonify({
        'success': True,
        'data': results,
        'count': len(results)
    })

@app.route('/api/portfolio')
def get_portfolio():
    """获取完整持仓数据"""
    portfolio = calculator.calculate_portfolio()
    return jsonify({
        'success': True,
        'data': portfolio
    })

@app.route('/api/portfolio/summary')
def get_portfolio_summary():
    """获取持仓摘要（快速）"""
    portfolio = calculator.calculate_portfolio()
    return jsonify({
        'success': True,
        'data': portfolio.get('summary', {})
    })

@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    """获取持仓列表"""
    holdings = calculator.load_holdings()
    return jsonify({
        'success': True,
        'data': holdings
    })

@app.route('/api/holdings', methods=['POST'])
def add_holding():
    """添加持仓"""
    data = request.json
    if not data or 'code' not in data or 'shares' not in data:
        return jsonify({
            'success': False,
            'error': 'Missing required fields: code, shares'
        }), 400
    
    holdings = calculator.load_holdings()
    
    # 检查是否已存在
    existing = next((h for h in holdings if h['code'] == data['code']), None)
    if existing:
        # 更新
        existing['shares'] = data['shares']
        existing['cost'] = data.get('cost', existing.get('cost'))
    else:
        # 新增
        holdings.append({
            'code': data['code'],
            'name': data.get('name', ''),
            'shares': data['shares'],
            'cost': data.get('cost', 0),
            'addedDate': datetime.now().strftime('%Y-%m-%d')
        })
    
    calculator.save_holdings(holdings)
    
    return jsonify({
        'success': True,
        'message': 'Holding updated successfully'
    })

@app.route('/api/holdings/<code>', methods=['DELETE'])
def delete_holding(code):
    """删除持仓"""
    holdings = calculator.load_holdings()
    holdings = [h for h in holdings if h['code'] != code]
    calculator.save_holdings(holdings)
    
    return jsonify({
        'success': True,
        'message': 'Holding deleted successfully'
    })

@app.route('/api/health')
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_size': len(data_service.cache)
    })

if __name__ == '__main__':
    print("=" * 60)
    print("Portfolio Pro API 服务")
    print("=" * 60)
    print("API 端点:")
    print("  GET  /api/stock/<code>     - 单只股票数据")
    print("  GET  /api/stocks?codes=... - 批量股票数据")
    print("  GET  /api/portfolio        - 完整持仓数据")
    print("  GET  /api/portfolio/summary- 持仓摘要")
    print("  GET  /api/holdings         - 持仓列表")
    print("  POST /api/holdings         - 添加/更新持仓")
    print("  DEL  /api/holdings/<code>   - 删除持仓")
    print("  GET  /api/health           - 健康检查")
    print("=" * 60)
    
    # 生产环境使用 gunicorn: gunicorn -w 4 -b 0.0.0.0:5000 api_server:app
    app.run(host='0.0.0.0', port=5000, debug=True)
