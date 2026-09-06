export const FEATURE_ENGINEERING_DATA = {
  FINANCE: [
    {
      category: "Returns & Price",
      name: "Simple Daily Return",
      code: "df['ret'] = df['close'].pct_change()",
    },
    {
      category: "Returns & Price",
      name: "Log Return",
      code: "df['log_ret'] = np.log(df['close'] / df['close'].shift(1))",
    },
    {
      category: "Returns & Price",
      name: "Cumulative Return",
      code: "df['cum_ret'] = (1 + df['ret']).cumprod() - 1",
    },
    {
      category: "Returns & Price",
      name: "Rolling 5-day Return",
      code: "df['ret_5d'] = df['close'].pct_change(5)",
    },
    {
      category: "Returns & Price",
      name: "Rolling 10-day Return",
      code: "df['ret_10d'] = df['close'].pct_change(10)",
    },
    {
      category: "Returns & Price",
      name: "Rolling 21-day Return",
      code: "df['ret_21d'] = df['close'].pct_change(21)",
    },
    {
      category: "Returns & Price",
      name: "Rolling 63-day Return",
      code: "df['ret_63d'] = df['close'].pct_change(63)",
    },
    {
      category: "Returns & Price",
      name: "Price Momentum 12-1",
      code: "df['mom'] = df['close'].pct_change(252) - df['close'].pct_change(21)",
    },
    {
      category: "Returns & Price",
      name: "Overnight Gap",
      code: "df['gap'] = (df['open'] - df['close'].shift(1)) / df['close'].shift(1)",
    },
    {
      category: "Returns & Price",
      name: "Intraday Return",
      code: "df['intraday'] = (df['close'] - df['open']) / df['open']",
    },
    {
      category: "Returns & Price",
      name: "High-Low Range",
      code: "df['hl_range'] = (df['high'] - df['low']) / df['close']",
    },
    {
      category: "Returns & Price",
      name: "Price Relative to 52w High",
      code: "df['rel_52h'] = df['close'] / df['close'].rolling(252).max()",
    },
    {
      category: "Returns & Price",
      name: "Price Relative to 52w Low",
      code: "df['rel_52l'] = df['close'] / df['close'].rolling(252).min()",
    },
    {
      category: "Returns & Price",
      name: "Distance from ATH",
      code: "df['drawdown'] = df['close'] / df['close'].cummax() - 1",
    },
    {
      category: "Returns & Price",
      name: "Price Change in $",
      code: "df['price_change'] = df['close'].diff()",
    },
    {
      category: "Returns & Price",
      name: "Normalized Price",
      code: "df['norm_price'] = (df['close'] - df['close'].mean()) / df['close'].std()",
    },
    {
      category: "Returns & Price",
      name: "Price Z-Score 20d",
      code: "df['z20'] = (df['close'] - df['close'].rolling(20).mean()) / df['close'].rolling(20).std()",
    },
    {
      category: "Returns & Price",
      name: "Log Price",
      code: "df['log_price'] = np.log(df['close'])",
    },
    {
      category: "Returns & Price",
      name: "OHLC Average",
      code: "df['ohlc_avg'] = (df['open']+df['high']+df['low']+df['close'])/4",
    },
    {
      category: "Returns & Price",
      name: "Typical Price",
      code: "df['typical'] = (df['high']+df['low']+df['close'])/3",
    },
    {
      category: "Returns & Price",
      name: "Weighted Close",
      code: "df['wclose'] = (df['high']+df['low']+2*df['close'])/4",
    },
    {
      category: "Returns & Price",
      name: "Price Acceleration",
      code: "df['accel'] = df['ret'].diff()",
    },
    {
      category: "Returns & Price",
      name: "Ret Skewness 60d",
      code: "df['skew60'] = df['ret'].rolling(60).skew()",
    },
    {
      category: "Returns & Price",
      name: "Ret Kurtosis 60d",
      code: "df['kurt60'] = df['ret'].rolling(60).kurt()",
    },
    {
      category: "Returns & Price",
      name: "Positive Days Ratio",
      code: "df['pos_ratio'] = (df['ret']>0).rolling(20).mean()",
    },
    {
      category: "Returns & Price",
      name: "Max Return 20d",
      code: "df['max_ret20'] = df['ret'].rolling(20).max()",
    },
    {
      category: "Returns & Price",
      name: "Min Return 20d",
      code: "df['min_ret20'] = df['ret'].rolling(20).min()",
    },
    {
      category: "Returns & Price",
      name: "Return Spread 5-20",
      code: "df['spread'] = df['ret'].rolling(5).mean() - df['ret'].rolling(20).mean()",
    },
    {
      category: "Returns & Price",
      name: "True Range",
      code: "df['tr'] = pd.concat([df['high']-df['low'], abs(df['high']-df['close'].shift()), abs(df['low']-df['close'].shift())],axis=1).max(axis=1)",
    },
    {
      category: "Returns & Price",
      name: "ATR 14",
      code: "df['atr14'] = df['tr'].rolling(14).mean()",
    },
    {
      category: "Moving Averages",
      name: "SMA 5",
      code: "df['sma5'] = df['close'].rolling(5).mean()",
    },
    {
      category: "Moving Averages",
      name: "SMA 10",
      code: "df['sma10'] = df['close'].rolling(10).mean()",
    },
    {
      category: "Moving Averages",
      name: "SMA 20",
      code: "df['sma20'] = df['close'].rolling(20).mean()",
    },
    {
      category: "Moving Averages",
      name: "SMA 50",
      code: "df['sma50'] = df['close'].rolling(50).mean()",
    },
    {
      category: "Moving Averages",
      name: "SMA 200",
      code: "df['sma200'] = df['close'].rolling(200).mean()",
    },
    {
      category: "Moving Averages",
      name: "EMA 12",
      code: "df['ema12'] = df['close'].ewm(span=12).mean()",
    },
    {
      category: "Moving Averages",
      name: "EMA 26",
      code: "df['ema26'] = df['close'].ewm(span=26).mean()",
    },
    {
      category: "Moving Averages",
      name: "EMA 50",
      code: "df['ema50'] = df['close'].ewm(span=50).mean()",
    },
    {
      category: "Moving Averages",
      name: "WMA 10",
      code: "w=np.arange(1,11); df['wma10']=df['close'].rolling(10).apply(lambda x:(x*w).sum()/w.sum())",
    },
    {
      category: "Moving Averages",
      name: "DEMA 20",
      code: "ema=df['close'].ewm(span=20).mean(); df['dema20']=2*ema - ema.ewm(span=20).mean()",
    },
    {
      category: "Moving Averages",
      name: "Price vs SMA20 ratio",
      code: "df['p_sma20'] = df['close'] / df['sma20']",
    },
    {
      category: "Moving Averages",
      name: "Price vs SMA50 ratio",
      code: "df['p_sma50'] = df['close'] / df['sma50']",
    },
    {
      category: "Moving Averages",
      name: "SMA Cross 5-20",
      code: "df['cross_5_20'] = (df['sma5'] > df['sma20']).astype(int)",
    },
    {
      category: "Moving Averages",
      name: "SMA Cross 20-50",
      code: "df['cross_20_50'] = (df['sma20'] > df['sma50']).astype(int)",
    },
    {
      category: "Moving Averages",
      name: "SMA Cross 50-200",
      code: "df['golden_cross'] = (df['sma50'] > df['sma200']).astype(int)",
    },
    {
      category: "Moving Averages",
      name: "SMA Spread %",
      code: "df['sma_spread'] = (df['sma20'] - df['sma50']) / df['sma50']",
    },
    {
      category: "Moving Averages",
      name: "MACD Line",
      code: "df['macd'] = df['ema12'] - df['ema26']",
    },
    {
      category: "Moving Averages",
      name: "MACD Signal",
      code: "df['macd_sig'] = df['macd'].ewm(span=9).mean()",
    },
    {
      category: "Moving Averages",
      name: "MACD Histogram",
      code: "df['macd_hist'] = df['macd'] - df['macd_sig']",
    },
    {
      category: "Moving Averages",
      name: "MACD Divergence",
      code: "df['macd_div'] = np.sign(df['macd_hist'].diff())",
    },
    {
      category: "Moving Averages",
      name: "Adaptive MA (Kaufman)",
      code: "# use ta library: ta.trend.kama(df['close'])",
    },
    {
      category: "Moving Averages",
      name: "Hull MA 16",
      code: "wma_half=df['close'].rolling(8).apply(lambda x:(x*np.arange(1,9)).sum()/36); wma_full=df['close'].rolling(16).apply(lambda x:(x*np.arange(1,17)).sum()/136); df['hma16']=(2*wma_half-wma_full).rolling(4).apply(lambda x:(x*np.arange(1,5)).sum()/10)",
    },
    {
      category: "Moving Averages",
      name: "Volume-weighted MA 20",
      code: "df['vwma20'] = (df['close']*df['volume']).rolling(20).sum() / df['volume'].rolling(20).sum()",
    },
    {
      category: "Volatility",
      name: "Realized Vol 10d",
      code: "df['rvol10'] = df['ret'].rolling(10).std() * np.sqrt(252)",
    },
    {
      category: "Volatility",
      name: "Realized Vol 21d",
      code: "df['rvol21'] = df['ret'].rolling(21).std() * np.sqrt(252)",
    },
    {
      category: "Volatility",
      name: "Realized Vol 63d",
      code: "df['rvol63'] = df['ret'].rolling(63).std() * np.sqrt(252)",
    },
    {
      category: "Volatility",
      name: "Garman-Klass Vol",
      code: "df['gk_vol'] = np.sqrt(0.5*np.log(df['high']/df['low'])**2 - (2*np.log(2)-1)*np.log(df['close']/df['open'])**2)",
    },
    {
      category: "Volatility",
      name: "Parkinson Vol",
      code: "df['park_vol'] = np.sqrt((1/(4*np.log(2)))*np.log(df['high']/df['low'])**2)",
    },
    {
      category: "Volatility",
      name: "Vol Ratio short/long",
      code: "df['vol_ratio'] = df['rvol10'] / df['rvol63']",
    },
    {
      category: "Volatility",
      name: "Vol of Vol",
      code: "df['vol_of_vol'] = df['rvol21'].rolling(21).std()",
    },
    {
      category: "Volatility",
      name: "Bollinger Upper",
      code: "df['bb_up'] = df['sma20'] + 2*df['close'].rolling(20).std()",
    },
    {
      category: "Volatility",
      name: "Bollinger Lower",
      code: "df['bb_lo'] = df['sma20'] - 2*df['close'].rolling(20).std()",
    },
    {
      category: "Volatility",
      name: "Bollinger Width",
      code: "df['bb_width'] = (df['bb_up'] - df['bb_lo']) / df['sma20']",
    },
    {
      category: "Volatility",
      name: "Bollinger %B",
      code: "df['bb_pct'] = (df['close'] - df['bb_lo']) / (df['bb_up'] - df['bb_lo'])",
    },
    {
      category: "Volatility",
      name: "Keltner Upper",
      code: "df['kelt_up'] = df['ema20'] + 2*df['atr14']",
    },
    {
      category: "Volatility",
      name: "Keltner Lower",
      code: "df['kelt_lo'] = df['ema20'] - 2*df['atr14']",
    },
    {
      category: "Volatility",
      name: "Squeeze (BB inside KC)",
      code: "df['squeeze'] = (df['bb_lo'] > df['kelt_lo']).astype(int)",
    },
    {
      category: "Volatility",
      name: "Historical Vol Percentile",
      code: "df['vol_pct'] = df['rvol21'].rank(pct=True)",
    },
    {
      category: "Volatility",
      name: "Downside Deviation",
      code: "df['dd_dev'] = df['ret'].clip(upper=0).rolling(21).std() * np.sqrt(252)",
    },
    {
      category: "Volatility",
      name: "Upside Deviation",
      code: "df['ud_dev'] = df['ret'].clip(lower=0).rolling(21).std() * np.sqrt(252)",
    },
    {
      category: "Volatility",
      name: "VIX Proxy",
      code: "df['vix_proxy'] = df['rvol21'] * 100",
    },
    {
      category: "Momentum / Oscillators",
      name: "RSI 14",
      code: "delta=df['close'].diff(); gain=delta.clip(lower=0).rolling(14).mean(); loss=(-delta.clip(upper=0)).rolling(14).mean(); df['rsi14']=100-100/(1+gain/loss)",
    },
    {
      category: "Momentum / Oscillators",
      name: "RSI 9",
      code: "delta=df['close'].diff(); gain=delta.clip(lower=0).rolling(9).mean(); loss=(-delta.clip(upper=0)).rolling(9).mean(); df['rsi9']=100-100/(1+gain/loss)",
    },
    {
      category: "Momentum / Oscillators",
      name: "Stochastic %K",
      code: "lo14=df['low'].rolling(14).min(); hi14=df['high'].rolling(14).max(); df['stoch_k']=(df['close']-lo14)/(hi14-lo14)*100",
    },
    {
      category: "Momentum / Oscillators",
      name: "Stochastic %D",
      code: "df['stoch_d'] = df['stoch_k'].rolling(3).mean()",
    },
    {
      category: "Momentum / Oscillators",
      name: "Williams %R",
      code: "df['williams_r'] = (df['high'].rolling(14).max()-df['close'])/(df['high'].rolling(14).max()-df['low'].rolling(14).min())*-100",
    },
    {
      category: "Momentum / Oscillators",
      name: "CCI 20",
      code: "tp=(df['high']+df['low']+df['close'])/3; df['cci20']=(tp-tp.rolling(20).mean())/(0.015*tp.rolling(20).apply(lambda x:np.mean(np.abs(x-x.mean()))))",
    },
    {
      category: "Momentum / Oscillators",
      name: "Rate of Change 10",
      code: "df['roc10'] = df['close'].pct_change(10) * 100",
    },
    {
      category: "Momentum / Oscillators",
      name: "Momentum 10",
      code: "df['mom10'] = df['close'] - df['close'].shift(10)",
    },
    {
      category: "Momentum / Oscillators",
      name: "PPO",
      code: "df['ppo'] = (df['ema12'] - df['ema26']) / df['ema26'] * 100",
    },
    {
      category: "Momentum / Oscillators",
      name: "DPO 20",
      code: "df['dpo'] = df['close'].shift(11) - df['close'].rolling(20).mean()",
    },
    {
      category: "Momentum / Oscillators",
      name: "Aroon Up 25",
      code: "df['aroon_up'] = df['high'].rolling(25).apply(lambda x: (x.argmax())/25*100)",
    },
    {
      category: "Momentum / Oscillators",
      name: "Aroon Down 25",
      code: "df['aroon_dn'] = df['low'].rolling(25).apply(lambda x: (x.argmin())/25*100)",
    },
    {
      category: "Momentum / Oscillators",
      name: "Aroon Oscillator",
      code: "df['aroon_osc'] = df['aroon_up'] - df['aroon_dn']",
    },
    {
      category: "Momentum / Oscillators",
      name: "Ultimate Oscillator",
      code: "# complex – use ta.momentum.UltimateOscillator(df['high'],df['low'],df['close']).ultimate_oscillator()",
    },
    {
      category: "Momentum / Oscillators",
      name: "TSI",
      code: "m=df['close'].diff(); abs_m=m.abs(); df['tsi']=100*(m.ewm(25).mean().ewm(13).mean())/(abs_m.ewm(25).mean().ewm(13).mean())",
    },
    {
      category: "Momentum / Oscillators",
      name: "Awesome Oscillator",
      code: "mp=(df['high']+df['low'])/2; df['ao']=mp.rolling(5).mean()-mp.rolling(34).mean()",
    },
    {
      category: "Volume",
      name: "Volume SMA 20",
      code: "df['vol_sma20'] = df['volume'].rolling(20).mean()",
    },
    {
      category: "Volume",
      name: "Relative Volume",
      code: "df['rvol'] = df['volume'] / df['vol_sma20']",
    },
    {
      category: "Volume",
      name: "Volume Z-Score",
      code: "df['vol_z'] = (df['volume'] - df['vol_sma20']) / df['volume'].rolling(20).std()",
    },
    {
      category: "Volume",
      name: "OBV",
      code: "df['obv'] = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()",
    },
    {
      category: "Volume",
      name: "OBV Signal",
      code: "df['obv_sig'] = df['obv'].ewm(span=13).mean()",
    },
    {
      category: "Volume",
      name: "Volume-Price Trend",
      code: "df['vpt'] = (df['ret'] * df['volume']).cumsum()",
    },
    {
      category: "Volume",
      name: "MFI 14",
      code: "tp=(df['high']+df['low']+df['close'])/3; mf=tp*df['volume']; pos_mf=mf.where(tp>tp.shift(),0).rolling(14).sum(); neg_mf=mf.where(tp<tp.shift(),0).rolling(14).sum(); df['mfi14']=100-100/(1+pos_mf/neg_mf)",
    },
    {
      category: "Volume",
      name: "Chaikin MF",
      code: "clv=((df['close']-df['low'])-(df['high']-df['close']))/(df['high']-df['low']); df['cmf']=(clv*df['volume']).rolling(20).sum()/df['volume'].rolling(20).sum()",
    },
    {
      category: "Volume",
      name: "AD Line",
      code: "clv=((df['close']-df['low'])-(df['high']-df['close']))/(df['high']-df['low']); df['ad']=(clv*df['volume']).cumsum()",
    },
    {
      category: "Volume",
      name: "Force Index 13",
      code: "df['fi13'] = (df['close'].diff() * df['volume']).ewm(span=13).mean()",
    },
    {
      category: "Volume",
      name: "Ease of Movement",
      code: "dm=(df['high']+df['low'])/2-(df['high'].shift()+df['low'].shift())/2; box=df['volume']/(df['high']-df['low']); df['eom']=dm/box",
    },
    {
      category: "Volume",
      name: "Volume ROC",
      code: "df['vroc'] = df['volume'].pct_change(10) * 100",
    },
    {
      category: "Volume",
      name: "Dollar Volume",
      code: "df['dollar_vol'] = df['close'] * df['volume']",
    },
    {
      category: "Volume",
      name: "Log Volume",
      code: "df['log_vol'] = np.log1p(df['volume'])",
    },
    {
      category: "Volume",
      name: "Up/Down Volume Ratio",
      code: "df['ud_vol'] = df['volume'].where(df['ret']>0,0).rolling(10).sum() / df['volume'].where(df['ret']<0,0).rolling(10).sum()",
    },
    {
      category: "Risk Metrics",
      name: "Sharpe Ratio 252d",
      code: "df['sharpe'] = df['ret'].rolling(252).mean() / df['ret'].rolling(252).std() * np.sqrt(252)",
    },
    {
      category: "Risk Metrics",
      name: "Sortino Ratio 252d",
      code: "dr=df['ret'].clip(upper=0).rolling(252).std(); df['sortino']=df['ret'].rolling(252).mean()/dr*np.sqrt(252)",
    },
    {
      category: "Risk Metrics",
      name: "Max Drawdown 252d",
      code: "df['mdd'] = (df['close']/df['close'].rolling(252).max()-1).rolling(252).min()",
    },
    {
      category: "Risk Metrics",
      name: "Calmar Ratio",
      code: "df['calmar'] = df['ret'].rolling(252).mean()*252 / df['mdd'].abs()",
    },
    {
      category: "Risk Metrics",
      name: "VaR 95% 21d",
      code: "df['var95'] = df['ret'].rolling(21).quantile(0.05)",
    },
    {
      category: "Risk Metrics",
      name: "CVaR 95% 21d",
      code: "df['cvar95'] = df['ret'].rolling(21).apply(lambda x: x[x<=np.percentile(x,5)].mean())",
    },
    {
      category: "Risk Metrics",
      name: "Beta vs Market",
      code: "cov=df['ret'].rolling(252).cov(df['mkt_ret']); var=df['mkt_ret'].rolling(252).var(); df['beta']=cov/var",
    },
    {
      category: "Risk Metrics",
      name: "Correlation vs Market",
      code: "df['corr_mkt'] = df['ret'].rolling(63).corr(df['mkt_ret'])",
    },
    {
      category: "Risk Metrics",
      name: "Tracking Error",
      code: "df['te'] = (df['ret']-df['bench_ret']).rolling(252).std()*np.sqrt(252)",
    },
    {
      category: "Risk Metrics",
      name: "Information Ratio",
      code: "er=df['ret']-df['bench_ret']; df['ir']=er.rolling(252).mean()/er.rolling(252).std()*np.sqrt(252)",
    },
    {
      category: "Risk Metrics",
      name: "Ulcer Index",
      code: "dd=df['close']/df['close'].rolling(14).max()-1; df['ulcer']=np.sqrt((dd**2).rolling(14).mean())",
    },
    {
      category: "Risk Metrics",
      name: "Omega Ratio",
      code: "threshold=0; gains=df['ret'].clip(lower=threshold).rolling(252).sum(); losses=(-df['ret'].clip(upper=threshold)).rolling(252).sum(); df['omega']=gains/losses",
    },
    {
      category: "Credit & Fundamental",
      name: "Debt-to-Equity",
      code: "df['de_ratio'] = df['total_debt'] / df['equity']",
    },
    {
      category: "Credit & Fundamental",
      name: "Interest Coverage",
      code: "df['int_cov'] = df['ebit'] / df['interest_expense']",
    },
    {
      category: "Credit & Fundamental",
      name: "Current Ratio",
      code: "df['cur_ratio'] = df['current_assets'] / df['current_liabilities']",
    },
    {
      category: "Credit & Fundamental",
      name: "Quick Ratio",
      code: "df['quick'] = (df['current_assets'] - df['inventory']) / df['current_liabilities']",
    },
    {
      category: "Credit & Fundamental",
      name: "P/E Ratio",
      code: "df['pe'] = df['price'] / df['eps']",
    },
    {
      category: "Credit & Fundamental",
      name: "Forward P/E",
      code: "df['fwd_pe'] = df['price'] / df['fwd_eps']",
    },
    {
      category: "Credit & Fundamental",
      name: "P/B Ratio",
      code: "df['pb'] = df['price'] / df['book_value_ps']",
    },
    {
      category: "Credit & Fundamental",
      name: "P/S Ratio",
      code: "df['ps'] = df['market_cap'] / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "EV/EBITDA",
      code: "df['ev_ebitda'] = df['enterprise_value'] / df['ebitda']",
    },
    {
      category: "Credit & Fundamental",
      name: "ROE",
      code: "df['roe'] = df['net_income'] / df['equity']",
    },
    {
      category: "Credit & Fundamental",
      name: "ROA",
      code: "df['roa'] = df['net_income'] / df['total_assets']",
    },
    {
      category: "Credit & Fundamental",
      name: "ROIC",
      code: "df['roic'] = df['nopat'] / df['invested_capital']",
    },
    {
      category: "Credit & Fundamental",
      name: "Gross Margin",
      code: "df['gross_margin'] = (df['revenue'] - df['cogs']) / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "EBITDA Margin",
      code: "df['ebitda_margin'] = df['ebitda'] / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "Net Margin",
      code: "df['net_margin'] = df['net_income'] / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "Revenue Growth YoY",
      code: "df['rev_growth'] = df['revenue'].pct_change(4)  # quarterly",
    },
    {
      category: "Credit & Fundamental",
      name: "EPS Growth YoY",
      code: "df['eps_growth'] = df['eps'].pct_change(4)",
    },
    {
      category: "Credit & Fundamental",
      name: "Dividend Yield",
      code: "df['div_yield'] = df['annual_div'] / df['price']",
    },
    {
      category: "Credit & Fundamental",
      name: "Payout Ratio",
      code: "df['payout'] = df['dividends'] / df['net_income']",
    },
    {
      category: "Credit & Fundamental",
      name: "Asset Turnover",
      code: "df['asset_turn'] = df['revenue'] / df['total_assets']",
    },
    {
      category: "Credit & Fundamental",
      name: "Inventory Turnover",
      code: "df['inv_turn'] = df['cogs'] / df['inventory']",
    },
    {
      category: "Credit & Fundamental",
      name: "Receivables Turnover",
      code: "df['rec_turn'] = df['revenue'] / df['accounts_receivable']",
    },
    {
      category: "Credit & Fundamental",
      name: "Altman Z-Score",
      code: "df['z_score']=1.2*(df['working_capital']/df['total_assets'])+1.4*(df['retained_earnings']/df['total_assets'])+3.3*(df['ebit']/df['total_assets'])+0.6*(df['market_cap']/df['total_liabilities'])+df['revenue']/df['total_assets']",
    },
    {
      category: "Credit & Fundamental",
      name: "Piotroski F-Score (partial)",
      code: "df['f1']=(df['roa']>0).astype(int); df['f2']=(df['roa'].diff()>0).astype(int); df['f_partial']=df['f1']+df['f2']",
    },
    {
      category: "Credit & Fundamental",
      name: "Earnings Surprise",
      code: "df['earn_surp'] = (df['actual_eps'] - df['est_eps']) / df['est_eps'].abs()",
    },
    {
      category: "Credit & Fundamental",
      name: "Book Value Growth",
      code: "df['bv_growth'] = df['book_value_ps'].pct_change(4)",
    },
    {
      category: "Credit & Fundamental",
      name: "Free Cash Flow Yield",
      code: "df['fcf_yield'] = df['fcf'] / df['market_cap']",
    },
    {
      category: "Credit & Fundamental",
      name: "Capex Ratio",
      code: "df['capex_ratio'] = df['capex'] / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "R&D Intensity",
      code: "df['rnd_intensity'] = df['rd_expense'] / df['revenue']",
    },
    {
      category: "Credit & Fundamental",
      name: "Net Debt / EBITDA",
      code: "df['lev'] = (df['total_debt']-df['cash']) / df['ebitda']",
    },
    {
      category: "Yield & Rates",
      name: "Yield Curve Slope 10y-2y",
      code: "df['slope'] = df['y10'] - df['y2']",
    },
    {
      category: "Yield & Rates",
      name: "Yield Curve Curvature",
      code: "df['curv'] = 2*df['y5'] - df['y2'] - df['y10']",
    },
    {
      category: "Yield & Rates",
      name: "Real Yield",
      code: "df['real_y'] = df['nominal_y'] - df['inflation']",
    },
    {
      category: "Yield & Rates",
      name: "Credit Spread",
      code: "df['credit_spread'] = df['corp_yield'] - df['tsy_yield']",
    },
    {
      category: "Yield & Rates",
      name: "OAS",
      code: "df['oas'] = df['bond_yield'] - df['benchmark_yield'] - df['option_cost']",
    },
    {
      category: "Yield & Rates",
      name: "Duration",
      code: "# approximate: df['dur'] = (df['bond_price'].pct_change(-1)) / -df['yield'].diff(-1)",
    },
    {
      category: "Yield & Rates",
      name: "DV01",
      code: "df['dv01'] = df['duration'] * df['bond_price'] / 10000",
    },
    {
      category: "Yield & Rates",
      name: "Convexity Proxy",
      code: "df['convex'] = df['duration']**2 + df['duration']",
    },
    {
      category: "Yield & Rates",
      name: "Rate Change 1M",
      code: "df['rate_chg1m'] = df['rate'].diff(21)",
    },
    {
      category: "Yield & Rates",
      name: "Rate Change 3M",
      code: "df['rate_chg3m'] = df['rate'].diff(63)",
    },
    {
      category: "Yield & Rates",
      name: "Rate Momentum",
      code: "df['rate_mom'] = df['rate'].diff(252) - df['rate'].diff(21)",
    },
    {
      category: "Yield & Rates",
      name: "Term Premium",
      code: "df['term_prem'] = df['y10'] - df['exp_short_rate']",
    },
    {
      category: "Yield & Rates",
      name: "LIBOR-OIS Spread",
      code: "df['lo_spread'] = df['libor_3m'] - df['ois_3m']",
    },
    {
      category: "Yield & Rates",
      name: "TED Spread",
      code: "df['ted'] = df['libor_3m'] - df['tbill_3m']",
    },
    {
      category: "Forex & Macro",
      name: "FX Return",
      code: "df['fx_ret'] = df['fx_rate'].pct_change()",
    },
    {
      category: "Forex & Macro",
      name: "FX Vol 30d",
      code: "df['fx_vol'] = df['fx_ret'].rolling(30).std() * np.sqrt(252)",
    },
    {
      category: "Forex & Macro",
      name: "PPP Deviation",
      code: "df['ppp_dev'] = np.log(df['spot_rate'] / df['ppp_rate'])",
    },
    {
      category: "Forex & Macro",
      name: "Real Effective Exchange Rate",
      code: "df['reer'] = df['nominal_er'] * (df['cpi_foreign'] / df['cpi_domestic'])",
    },
    {
      category: "Forex & Macro",
      name: "Carry Trade Signal",
      code: "df['carry'] = df['foreign_rate'] - df['domestic_rate']",
    },
    {
      category: "Forex & Macro",
      name: "Inflation Delta",
      code: "df['inf_delta'] = df['cpi'].pct_change(12)",
    },
    {
      category: "Forex & Macro",
      name: "GDP Growth Rate",
      code: "df['gdp_growth'] = df['gdp'].pct_change(4)",
    },
    {
      category: "Forex & Macro",
      name: "Unemployment Change",
      code: "df['unemp_chg'] = df['unemployment'].diff()",
    },
    {
      category: "Forex & Macro",
      name: "PMI Above 50",
      code: "df['pmi_exp'] = (df['pmi'] > 50).astype(int)",
    },
    {
      category: "Forex & Macro",
      name: "Consumer Confidence Change",
      code: "df['cc_chg'] = df['consumer_conf'].pct_change()",
    },
    {
      category: "Forex & Macro",
      name: "M2 Growth",
      code: "df['m2_growth'] = df['m2'].pct_change(12)",
    },
    {
      category: "Forex & Macro",
      name: "Yield vs Inflation Gap",
      code: "df['real_gap'] = df['y10'] - df['cpi_yoy']",
    },
    {
      category: "Time / Calendar",
      name: "Day of Week",
      code: "df['dow'] = pd.to_datetime(df['date']).dt.dayofweek",
    },
    {
      category: "Time / Calendar",
      name: "Month",
      code: "df['month'] = pd.to_datetime(df['date']).dt.month",
    },
    {
      category: "Time / Calendar",
      name: "Quarter",
      code: "df['quarter'] = pd.to_datetime(df['date']).dt.quarter",
    },
    {
      category: "Time / Calendar",
      name: "Is Month End",
      code: "df['month_end'] = pd.to_datetime(df['date']).dt.is_month_end.astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Is Month Start",
      code: "df['month_start'] = pd.to_datetime(df['date']).dt.is_month_start.astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Is Quarter End",
      code: "df['qtr_end'] = pd.to_datetime(df['date']).dt.is_quarter_end.astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Days to Earnings",
      code: "df['days_earn'] = (df['earn_date'] - pd.to_datetime(df['date'])).dt.days",
    },
    {
      category: "Time / Calendar",
      name: "January Dummy",
      code: "df['jan'] = (df['month'] == 1).astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Monday Effect",
      code: "df['monday'] = (df['dow'] == 0).astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Friday Effect",
      code: "df['friday'] = (df['dow'] == 4).astype(int)",
    },
    {
      category: "Time / Calendar",
      name: "Year",
      code: "df['year'] = pd.to_datetime(df['date']).dt.year",
    },
    {
      category: "Time / Calendar",
      name: "Week of Year",
      code: "df['week'] = pd.to_datetime(df['date']).dt.isocalendar().week",
    },
    {
      category: "Time / Calendar",
      name: "Days Since IPO",
      code: "df['days_ipo'] = (pd.to_datetime(df['date']) - pd.to_datetime(df['ipo_date'])).dt.days",
    },
    {
      category: "Encoding & Transforms",
      name: "Sector One-Hot",
      code: "df = pd.get_dummies(df, columns=['sector'], drop_first=True)",
    },
    {
      category: "Encoding & Transforms",
      name: "Rating Ordinal",
      code: "rating_map={'AAA':1,'AA':2,'A':3,'BBB':4,'BB':5,'B':6,'CCC':7}; df['rating_num']=df['rating'].map(rating_map)",
    },
    {
      category: "Encoding & Transforms",
      name: "Bin Volatility",
      code: "df['vol_bin'] = pd.cut(df['rvol21'], bins=5, labels=False)",
    },
    {
      category: "Encoding & Transforms",
      name: "Quantile Rank",
      code: "df['ret_rank'] = df['ret'].rank(pct=True)",
    },
    {
      category: "Encoding & Transforms",
      name: "Cross-Sectional Z-Score",
      code: "df['cs_z'] = df.groupby('date')['ret'].transform(lambda x:(x-x.mean())/x.std())",
    },
    {
      category: "Encoding & Transforms",
      name: "Winsorize 1-99%",
      code: "lo,hi=df['ret'].quantile([0.01,0.99]); df['ret_w']=df['ret'].clip(lo,hi)",
    },
    {
      category: "Encoding & Transforms",
      name: "Log Transform",
      code: "df['log_mktcap'] = np.log(df['market_cap'])",
    },
    {
      category: "Encoding & Transforms",
      name: "Square Root Transform",
      code: "df['sqrt_vol'] = np.sqrt(df['volume'])",
    },
    {
      category: "Encoding & Transforms",
      name: "Min-Max Scale",
      code: "df['scaled'] = (df['feat'] - df['feat'].min()) / (df['feat'].max() - df['feat'].min())",
    },
    {
      category: "Encoding & Transforms",
      name: "Rolling Percentile Rank",
      code: "df['roll_pct'] = df['ret'].rolling(252).rank(pct=True)",
    },
    {
      category: "Encoding & Transforms",
      name: "Lag Feature 1",
      code: "df['ret_lag1'] = df['ret'].shift(1)",
    },
    {
      category: "Encoding & Transforms",
      name: "Lag Feature 5",
      code: "df['ret_lag5'] = df['ret'].shift(5)",
    },
    {
      category: "Encoding & Transforms",
      name: "Lead Feature 1",
      code: "df['ret_lead1'] = df['ret'].shift(-1)",
    },
    {
      category: "Encoding & Transforms",
      name: "Difference",
      code: "df['ret_diff'] = df['ret'].diff()",
    },
    {
      category: "Encoding & Transforms",
      name: "Second Difference",
      code: "df['ret_diff2'] = df['ret'].diff().diff()",
    },
    {
      category: "Encoding & Transforms",
      name: "Rolling Beta Normalize",
      code: "df['ret_bn'] = df['ret'] / df['beta']",
    },
    {
      category: "Encoding & Transforms",
      name: "Sign Feature",
      code: "df['ret_sign'] = np.sign(df['ret'])",
    },
    {
      category: "Encoding & Transforms",
      name: "Interaction: Ret × Vol",
      code: "df['ret_x_vol'] = df['ret'] * df['rvol21']",
    },
    {
      category: "Encoding & Transforms",
      name: "Interaction: PE × Growth",
      code: "df['peg'] = df['pe'] / df['eps_growth']",
    },
    {
      category: "Encoding & Transforms",
      name: "Polynomial Feature Ret^2",
      code: "df['ret2'] = df['ret'] ** 2",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Rolling Correlation 63d",
      code: "df['corr_63'] = df['ret_a'].rolling(63).corr(df['ret_b'])",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Covariance 63d",
      code: "df['cov_63'] = df['ret_a'].rolling(63).cov(df['ret_b'])",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Portfolio Return",
      code: "df['port_ret'] = df[['ret_a','ret_b','ret_c']].mean(axis=1)",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Equal-Weight Portfolio Vol",
      code: "df['port_vol'] = df[['ret_a','ret_b','ret_c']].rolling(63).std().mean(axis=1)",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Asset Class Spread",
      code: "df['spread_eq_bd'] = df['equity_ret'] - df['bond_ret']",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Risk Parity Weight",
      code: "df['rp_w'] = (1/df['rvol21']) / (1/df['rvol21']).sum()",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Sector Relative Return",
      code: "df['rel_sector'] = df['ret'] - df.groupby(['date','sector'])['ret'].transform('mean')",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Market Cap Bucket",
      code: "df['cap_bucket'] = pd.qcut(df['market_cap'],q=5,labels=['micro','small','mid','large','mega'])",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Style Score (Value)",
      code: "df['val_score'] = df[['pb','pe','ps']].rank(pct=True,ascending=False).mean(axis=1)",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Style Score (Quality)",
      code: "df['qual_score'] = df[['roe','gross_margin','int_cov']].rank(pct=True).mean(axis=1)",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Style Score (Momentum)",
      code: "df['mom_score'] = df[['ret_63d','ret_252d']].rank(pct=True).mean(axis=1)",
    },
    {
      category: "Portfolio / Cross-Asset",
      name: "Style Score (Low Vol)",
      code: "df['lv_score'] = df['rvol63'].rank(pct=True, ascending=False)",
    },
    {
      category: "Microstructure",
      name: "Bid-Ask Spread",
      code: "df['ba_spread'] = (df['ask'] - df['bid']) / df['mid']",
    },
    {
      category: "Microstructure",
      name: "Amihud Illiquidity",
      code: "df['amihud'] = df['ret'].abs() / df['dollar_vol']",
    },
    {
      category: "Microstructure",
      name: "Roll Spread Estimator",
      code: "df['roll'] = 2 * np.sqrt(-df['close'].diff().autocorr())",
    },
    {
      category: "Microstructure",
      name: "Kyle Lambda",
      code: "df['kyle_lambda'] = np.abs(df['ret']) / df['volume']",
    },
    {
      category: "Microstructure",
      name: "Trade Imbalance",
      code: "df['imbal'] = (df['buy_vol'] - df['sell_vol']) / df['volume']",
    },
    {
      category: "Microstructure",
      name: "Order Flow Toxicity (simplified)",
      code: "df['vpin'] = df['imbal'].abs().rolling(50).mean()",
    },
    {
      category: "Microstructure",
      name: "Turnover",
      code: "df['turnover'] = df['volume'] / df['shares_outstanding']",
    },
    {
      category: "Microstructure",
      name: "Short Interest Ratio",
      code: "df['sir'] = df['short_interest'] / df['avg_volume']",
    },
    {
      category: "Microstructure",
      name: "Float Adjusted Volume",
      code: "df['fadj_vol'] = df['volume'] / df['float']",
    },
    {
      category: "Microstructure",
      name: "Intraday Volatility Proxy",
      code: "df['id_vol'] = (df['high'] - df['low']) / df['open']",
    },
    {
      category: "Microstructure",
      name: "Tick Direction",
      code: "df['tick'] = np.sign(df['close'].diff())",
    },
    {
      category: "Microstructure",
      name: "Overnight Volatility",
      code: "df['on_vol'] = df['gap'].rolling(21).std()",
    },
    {
      category: "Microstructure",
      name: "Daytime Volatility",
      code: "df['day_vol'] = df['intraday'].rolling(21).std()",
    },
    {
      category: "Microstructure",
      name: "Price Impact",
      code: "df['price_impact'] = df['ret'].abs() / np.log1p(df['dollar_vol'])",
    },
    {
      category: "Sentiment / Alternative",
      name: "Analyst Consensus",
      code: "df['consensus'] = df['buy_ratings'] / (df['buy_ratings']+df['hold_ratings']+df['sell_ratings'])",
    },
    {
      category: "Sentiment / Alternative",
      name: "Estimate Revision",
      code: "df['est_rev'] = df['fwd_eps'].pct_change()",
    },
    {
      category: "Sentiment / Alternative",
      name: "Short Interest Change",
      code: "df['si_chg'] = df['short_interest'].pct_change()",
    },
    {
      category: "Sentiment / Alternative",
      name: "Insider Buy Ratio",
      code: "df['ins_buy'] = df['insider_buys'] / (df['insider_buys']+df['insider_sells']+1e-9)",
    },
    {
      category: "Sentiment / Alternative",
      name: "News Sentiment Score",
      code: "df['news_sent'] = df['pos_news'] / (df['pos_news']+df['neg_news']+1e-9)",
    },
    {
      category: "Sentiment / Alternative",
      name: "Options Put/Call Ratio",
      code: "df['pcr'] = df['put_vol'] / df['call_vol']",
    },
    {
      category: "Sentiment / Alternative",
      name: "Implied Vol vs Realized",
      code: "df['iv_rv'] = df['iv_30d'] - df['rvol21']*100",
    },
    {
      category: "Sentiment / Alternative",
      name: "Skew Signal",
      code: "df['skew_sig'] = df['iv_25p'] - df['iv_25c']",
    },
    {
      category: "Sentiment / Alternative",
      name: "Search Volume Index Change",
      code: "df['svi_chg'] = df['google_svi'].pct_change()",
    },
    {
      category: "Sentiment / Alternative",
      name: "Social Media Sentiment",
      code: "df['social_sent'] = df['positive_tweets'] / (df['total_tweets']+1e-9)",
    },
    {
      category: "Sentiment / Alternative",
      name: "ESG Score Percentile",
      code: "df['esg_pct'] = df['esg_score'].rank(pct=True)",
    },
    {
      category: "Sentiment / Alternative",
      name: "Short Squeeze Potential",
      code: "df['squeeze_pot'] = df['sir'] * df['rvol21']",
    },
    {
      category: "Sentiment / Alternative",
      name: "Analyst Estimate Dispersion",
      code: "df['est_disp'] = df['eps_std'] / df['fwd_eps'].abs()",
    },
    {
      category: "Sentiment / Alternative",
      name: "Earnings Guidance Binary",
      code: "df['guidance'] = df['guidance_text'].str.contains('positive|raised',case=False,na=False).astype(int)",
    },
    {
      category: "Sentiment / Alternative",
      name: "Surprise Beat Streak",
      code: "df['beat'] = (df['earn_surp'] > 0).astype(int); df['beat_streak'] = df['beat'] * (df['beat'].groupby((df['beat']!=df['beat'].shift()).cumsum()).cumcount()+1)",
    },
    {
      category: "Options / Derivatives",
      name: "Moneyness",
      code: "df['moneyness'] = df['underlying_price'] / df['strike']",
    },
    {
      category: "Options / Derivatives",
      name: "Intrinsic Value (Call)",
      code: "df['intrinsic'] = np.maximum(df['underlying'] - df['strike'], 0)",
    },
    {
      category: "Options / Derivatives",
      name: "Time Value",
      code: "df['time_value'] = df['option_price'] - df['intrinsic_value']",
    },
    {
      category: "Options / Derivatives",
      name: "Delta Approximation",
      code: "df['delta_approx'] = (df['opt_price_up'] - df['opt_price_dn']) / (2 * df['price_change'])",
    },
    {
      category: "Options / Derivatives",
      name: "Gamma Approximation",
      code: "df['gamma'] = (df['delta_up'] - df['delta_dn']) / df['price_change']",
    },
    {
      category: "Options / Derivatives",
      name: "Theta (Daily Decay)",
      code: "df['theta'] = df['option_price'].diff(-1)  # price change over 1 day",
    },
    {
      category: "Options / Derivatives",
      name: "Vega Proxy",
      code: "df['vega_proxy'] = df['option_price'].pct_change() / df['iv'].pct_change()",
    },
    {
      category: "Options / Derivatives",
      name: "IV Rank",
      code: "df['iv_rank'] = (df['iv'] - df['iv'].rolling(252).min()) / (df['iv'].rolling(252).max() - df['iv'].rolling(252).min()) * 100",
    },
    {
      category: "Options / Derivatives",
      name: "IV Percentile",
      code: "df['iv_pct'] = df['iv'].rolling(252).rank(pct=True)",
    },
    {
      category: "Options / Derivatives",
      name: "Open Interest Change",
      code: "df['oi_chg'] = df['open_interest'].diff()",
    },
    {
      category: "Options / Derivatives",
      name: "OI-Weighted Strike",
      code: "df['oi_strike'] = (df['strike'] * df['open_interest']).sum() / df['open_interest'].sum()",
    },
    {
      category: "Options / Derivatives",
      name: "Max Pain Level",
      code: "# df.groupby('strike').apply(lambda x: (x['call_oi']*(x['strike']-spot).clip(lower=0) + x['put_oi']*(spot-x['strike']).clip(lower=0)).sum()).idxmin()",
    },
    {
      category: "Options / Derivatives",
      name: "Futures Basis",
      code: "df['basis'] = df['futures_price'] - df['spot_price']",
    },
    {
      category: "Options / Derivatives",
      name: "Contango / Backwardation",
      code: "df['term_struct'] = np.sign(df['futures_price'] - df['spot_price'])",
    },
    {
      category: "Options / Derivatives",
      name: "Roll Yield",
      code: "df['roll_yield'] = (df['near_futures'] - df['far_futures']) / df['near_futures']",
    },
    {
      category: "Factor Models",
      name: "Fama-French Size Factor (SMB proxy)",
      code: "df['smb'] = df[df['market_cap'] < df['market_cap'].median()]['ret'].mean() - df[df['market_cap'] >= df['market_cap'].median()]['ret'].mean()",
    },
    {
      category: "Factor Models",
      name: "HML Value Factor proxy",
      code: "df['hml'] = df[df['pb'] < df['pb'].quantile(0.3)]['ret'].mean() - df[df['pb'] > df['pb'].quantile(0.7)]['ret'].mean()",
    },
    {
      category: "Factor Models",
      name: "Quality-Minus-Junk",
      code: "df['qmj'] = df['qual_score'].rank(pct=True) - 0.5",
    },
    {
      category: "Factor Models",
      name: "Alpha (Jensen's)",
      code: "df['alpha'] = df['ret'] - (df['rf'] + df['beta'] * (df['mkt_ret'] - df['rf']))",
    },
    {
      category: "Factor Models",
      name: "Residual Return",
      code: "df['resid_ret'] = df['ret'] - df['alpha'] - df['beta'] * df['mkt_ret']",
    },
    {
      category: "Factor Models",
      name: "Factor Exposure Z-score",
      code: "df['factor_z'] = (df['factor_val'] - df['factor_val'].mean()) / df['factor_val'].std()",
    },
    {
      category: "Factor Models",
      name: "Information Coefficient (IC)",
      code: "df['ic'] = df.groupby('date')[['signal','fwd_ret']].apply(lambda x: x['signal'].corr(x['fwd_ret']))",
    },
    {
      category: "Crypto / Digital Assets",
      name: "NVT Ratio",
      code: "df['nvt'] = df['market_cap'] / df['on_chain_volume']",
    },
    {
      category: "Crypto / Digital Assets",
      name: "MVRV Ratio",
      code: "df['mvrv'] = df['market_cap'] / df['realised_cap']",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Stock-to-Flow",
      code: "df['s2f'] = df['total_supply'] / df['annual_issuance']",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Hash Rate Growth",
      code: "df['hash_growth'] = df['hash_rate'].pct_change(30)",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Active Addresses Change",
      code: "df['addr_chg'] = df['active_addresses'].pct_change(7)",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Exchange Netflow",
      code: "df['netflow'] = df['exchange_inflow'] - df['exchange_outflow']",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Funding Rate Signal",
      code: "df['funding_signal'] = np.sign(df['funding_rate'])",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Long/Short Ratio",
      code: "df['ls_ratio'] = df['long_positions'] / df['short_positions']",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Realized Volatility (crypto)",
      code: "df['crypto_rvol'] = df['log_ret'].rolling(7).std() * np.sqrt(365)",
    },
    {
      category: "Crypto / Digital Assets",
      name: "Dominance Change",
      code: "df['dom_chg'] = df['btc_dominance'].diff(7)",
    },
  ],
  MARKETING: [
    {
      category: "Customer Acquisition",
      name: "CAC",
      code: "df['cac'] = df['marketing_spend'] / df['new_customers']",
    },
    {
      category: "Customer Acquisition",
      name: "CAC by Channel",
      code: "df['cac_ch'] = df.groupby('channel').apply(lambda x: x['spend']/x['new_customers'])",
    },
    {
      category: "Customer Acquisition",
      name: "Blended CAC",
      code: "df['blended_cac'] = df['total_spend'] / df['total_new_customers']",
    },
    {
      category: "Customer Acquisition",
      name: "Cost per Click (CPC)",
      code: "df['cpc'] = df['ad_spend'] / df['clicks']",
    },
    {
      category: "Customer Acquisition",
      name: "Cost per Lead (CPL)",
      code: "df['cpl'] = df['ad_spend'] / df['leads']",
    },
    {
      category: "Customer Acquisition",
      name: "Cost per Mille (CPM)",
      code: "df['cpm'] = (df['ad_spend'] / df['impressions']) * 1000",
    },
    {
      category: "Customer Acquisition",
      name: "Cost per Acquisition",
      code: "df['cpa'] = df['ad_spend'] / df['conversions']",
    },
    {
      category: "Customer Acquisition",
      name: "Lead Conversion Rate",
      code: "df['lead_cvr'] = df['customers'] / df['leads']",
    },
    {
      category: "Customer Acquisition",
      name: "Visitor to Lead Rate",
      code: "df['v2l'] = df['leads'] / df['visitors']",
    },
    {
      category: "Customer Acquisition",
      name: "Lead to Customer Rate",
      code: "df['l2c'] = df['customers'] / df['leads']",
    },
    {
      category: "Customer Acquisition",
      name: "Marketing Qualified Leads",
      code: "df['mql_rate'] = df['mqls'] / df['leads']",
    },
    {
      category: "Customer Acquisition",
      name: "Sales Qualified Leads",
      code: "df['sql_rate'] = df['sqls'] / df['mqls']",
    },
    {
      category: "Customer Acquisition",
      name: "Paid vs Organic Mix",
      code: "df['paid_ratio'] = df['paid_customers'] / df['total_customers']",
    },
    {
      category: "Customer Acquisition",
      name: "Viral Coefficient",
      code: "df['k_factor'] = df['invites_sent'] * df['invite_cvr']",
    },
    {
      category: "Customer Acquisition",
      name: "Time to First Purchase",
      code: "df['ttfp'] = (df['first_purchase_date'] - df['signup_date']).dt.days",
    },
    {
      category: "Customer Acquisition",
      name: "Signup to Activation Days",
      code: "df['s2a_days'] = (df['activation_date'] - df['signup_date']).dt.days",
    },
    {
      category: "Customer Acquisition",
      name: "Attribution Weight (Last Touch)",
      code: "df['attr_revenue'] = df.groupby('last_channel')['revenue'].transform('sum')",
    },
    {
      category: "Customer Acquisition",
      name: "Attribution Weight (First Touch)",
      code: "df['attr_revenue_ft'] = df.groupby('first_channel')['revenue'].transform('sum')",
    },
    {
      category: "Customer Acquisition",
      name: "Channel ROAS",
      code: "df['roas'] = df['revenue'] / df['ad_spend']",
    },
    {
      category: "Customer Acquisition",
      name: "Organic Share",
      code: "df['organic_share'] = df['organic_traffic'] / df['total_traffic']",
    },
    {
      category: "Engagement",
      name: "Click-Through Rate",
      code: "df['ctr'] = df['clicks'] / df['impressions']",
    },
    {
      category: "Engagement",
      name: "Open Rate (Email)",
      code: "df['open_rate'] = df['opens'] / df['emails_sent']",
    },
    {
      category: "Engagement",
      name: "Email Click Rate",
      code: "df['email_ctr'] = df['email_clicks'] / df['opens']",
    },
    {
      category: "Engagement",
      name: "Bounce Rate",
      code: "df['bounce_rate'] = df['bounces'] / df['sessions']",
    },
    {
      category: "Engagement",
      name: "Pages per Session",
      code: "df['pps'] = df['pageviews'] / df['sessions']",
    },
    {
      category: "Engagement",
      name: "Avg Session Duration",
      code: "df['avg_duration'] = df['total_duration'] / df['sessions']",
    },
    {
      category: "Engagement",
      name: "Scroll Depth Avg",
      code: "df['avg_scroll'] = df['scroll_events'].mean()",
    },
    {
      category: "Engagement",
      name: "Video Completion Rate",
      code: "df['vcr'] = df['video_completions'] / df['video_starts']",
    },
    {
      category: "Engagement",
      name: "Video View Rate",
      code: "df['vvr'] = df['views'] / df['impressions']",
    },
    {
      category: "Engagement",
      name: "Engagement Rate (Social)",
      code: "df['eng_rate'] = (df['likes']+df['comments']+df['shares']) / df['followers']",
    },
    {
      category: "Engagement",
      name: "Share of Voice",
      code: "df['sov'] = df['brand_mentions'] / df['total_category_mentions']",
    },
    {
      category: "Engagement",
      name: "Sentiment Score",
      code: "df['sentiment'] = df['pos_comments'] / (df['pos_comments']+df['neg_comments']+1e-9)",
    },
    {
      category: "Engagement",
      name: "Comment-to-Like Ratio",
      code: "df['c2l'] = df['comments'] / (df['likes']+1e-9)",
    },
    {
      category: "Engagement",
      name: "Virality Rate",
      code: "df['virality'] = df['shares'] / df['impressions']",
    },
    {
      category: "Engagement",
      name: "Save Rate",
      code: "df['save_rate'] = df['saves'] / df['impressions']",
    },
    {
      category: "Engagement",
      name: "Story Completion Rate",
      code: "df['story_cr'] = df['story_completions'] / df['story_starts']",
    },
    {
      category: "Engagement",
      name: "Dwell Time Index",
      code: "df['dwell_idx'] = df['avg_duration'] / df['avg_duration'].mean()",
    },
    {
      category: "Engagement",
      name: "Return Visit Rate",
      code: "df['rvr'] = df['returning_visitors'] / df['total_visitors']",
    },
    {
      category: "Engagement",
      name: "Content Interaction Rate",
      code: "df['content_ir'] = df['interactions'] / df['content_views']",
    },
    {
      category: "Engagement",
      name: "Amplification Rate",
      code: "df['amp_rate'] = df['shares'] / df['followers']",
    },
    {
      category: "Retention / Churn",
      name: "Retention Rate",
      code: "df['retention'] = df['active_end'] / df['active_start']",
    },
    {
      category: "Retention / Churn",
      name: "Churn Rate",
      code: "df['churn'] = df['churned'] / df['active_start']",
    },
    {
      category: "Retention / Churn",
      name: "Monthly Churn",
      code: "df['monthly_churn'] = df['churned_month'] / df['active_month_start']",
    },
    {
      category: "Retention / Churn",
      name: "Annual Churn (from monthly)",
      code: "df['annual_churn'] = 1 - (1 - df['monthly_churn'])**12",
    },
    {
      category: "Retention / Churn",
      name: "D1 Retention",
      code: "df['d1_ret'] = df['users_d1'] / df['users_d0']",
    },
    {
      category: "Retention / Churn",
      name: "D7 Retention",
      code: "df['d7_ret'] = df['users_d7'] / df['users_d0']",
    },
    {
      category: "Retention / Churn",
      name: "D30 Retention",
      code: "df['d30_ret'] = df['users_d30'] / df['users_d0']",
    },
    {
      category: "Retention / Churn",
      name: "Cohort Retention Pivot",
      code: "df.pivot_table(index='cohort',columns='period',values='retention_rate')",
    },
    {
      category: "Retention / Churn",
      name: "Resurrection Rate",
      code: "df['resurrect'] = df['reactivated'] / df['churned_prev']",
    },
    {
      category: "Retention / Churn",
      name: "Net Revenue Retention",
      code: "df['nrr'] = (df['mrr_start']+df['expansion']-df['contraction']-df['churn_rev']) / df['mrr_start']",
    },
    {
      category: "Retention / Churn",
      name: "Gross Revenue Retention",
      code: "df['grr'] = (df['mrr_start']-df['contraction']-df['churn_rev']) / df['mrr_start']",
    },
    {
      category: "Retention / Churn",
      name: "Survival Curve",
      code: "# use lifelines: kmf.fit(df['tenure'], df['churned'])",
    },
    {
      category: "Retention / Churn",
      name: "Churn Probability (logistic)",
      code: "# LogisticRegression().fit(X_train, y_churn) – use churn flag as target",
    },
    {
      category: "Retention / Churn",
      name: "Avg Customer Tenure",
      code: "df['avg_tenure'] = df['tenure_days'].mean()",
    },
    {
      category: "Retention / Churn",
      name: "Median Tenure by Segment",
      code: "df.groupby('segment')['tenure_days'].median()",
    },
    {
      category: "Retention / Churn",
      name: "Days Since Last Purchase",
      code: "df['days_since'] = (df['snapshot_date'] - df['last_purchase_date']).dt.days",
    },
    {
      category: "Retention / Churn",
      name: "Recency Score",
      code: "df['recency_score'] = pd.qcut(df['days_since'], q=5, labels=[5,4,3,2,1]).astype(int)",
    },
    {
      category: "Retention / Churn",
      name: "Win-back Probability",
      code: "df['wb_prob'] = 1 / (1 + np.exp(df['days_since'] / 30))",
    },
    {
      category: "Retention / Churn",
      name: "Expected Remaining Lifetime",
      code: "df['erl'] = 1 / df['monthly_churn']",
    },
    {
      category: "Retention / Churn",
      name: "Churn Risk Tier",
      code: "df['churn_tier'] = pd.cut(df['churn_score'], bins=[0,0.3,0.6,1], labels=['low','med','high'])",
    },
    {
      category: "CLV / LTV",
      name: "Simple LTV",
      code: "df['ltv'] = df['avg_order_value'] * df['purchase_freq'] * df['avg_customer_life']",
    },
    {
      category: "CLV / LTV",
      name: "LTV:CAC Ratio",
      code: "df['ltv_cac'] = df['ltv'] / df['cac']",
    },
    {
      category: "CLV / LTV",
      name: "Discounted LTV",
      code: "df['dltv'] = df['margin'] * df['purchase_freq'] / (df['discount_rate'] + df['churn'])",
    },
    {
      category: "CLV / LTV",
      name: "Gross LTV",
      code: "df['gross_ltv'] = df['revenue_per_customer'] * df['avg_customer_life']",
    },
    {
      category: "CLV / LTV",
      name: "Net LTV",
      code: "df['net_ltv'] = df['gross_ltv'] * df['gross_margin'] - df['cac']",
    },
    {
      category: "CLV / LTV",
      name: "LTV by Cohort",
      code: "df.groupby('cohort')['revenue'].cumsum()",
    },
    {
      category: "CLV / LTV",
      name: "Predicted 12M Revenue (BG/NBD proxy)",
      code: "df['pred_12m'] = df['frequency'] * df['avg_order_value'] * df['prob_alive']",
    },
    {
      category: "CLV / LTV",
      name: "Payback Period",
      code: "df['payback'] = df['cac'] / (df['avg_monthly_revenue'] * df['gross_margin_pct'])",
    },
    {
      category: "CLV / LTV",
      name: "CLV Segment",
      code: "df['clv_seg'] = pd.qcut(df['ltv'], q=4, labels=['bronze','silver','gold','platinum'])",
    },
    {
      category: "CLV / LTV",
      name: "Revenue per User",
      code: "df['arpu'] = df['revenue'] / df['active_users']",
    },
    {
      category: "CLV / LTV",
      name: "Average Revenue per Paying User",
      code: "df['arppu'] = df['revenue'] / df['paying_users']",
    },
    {
      category: "CLV / LTV",
      name: "Revenue Expansion Rate",
      code: "df['exp_rate'] = df['upsell_revenue'] / df['base_revenue']",
    },
    {
      category: "CLV / LTV",
      name: "Predicted Next Purchase",
      code: "df['next_purchase_pred'] = df['avg_interpurchase_days'] + df['last_purchase_age']",
    },
    {
      category: "RFM",
      name: "Recency (days)",
      code: "df['R'] = (df['snapshot_date'] - df['last_purchase']).dt.days",
    },
    {
      category: "RFM",
      name: "Frequency (count)",
      code: "df['F'] = df.groupby('customer_id')['order_id'].transform('count')",
    },
    {
      category: "RFM",
      name: "Monetary (sum)",
      code: "df['M'] = df.groupby('customer_id')['revenue'].transform('sum')",
    },
    {
      category: "RFM",
      name: "R Score (quintile)",
      code: "df['R_score'] = pd.qcut(df['R'], q=5, labels=[5,4,3,2,1]).astype(int)",
    },
    {
      category: "RFM",
      name: "F Score (quintile)",
      code: "df['F_score'] = pd.qcut(df['F'].rank(method='first'), q=5, labels=[1,2,3,4,5]).astype(int)",
    },
    {
      category: "RFM",
      name: "M Score (quintile)",
      code: "df['M_score'] = pd.qcut(df['M'], q=5, labels=[1,2,3,4,5]).astype(int)",
    },
    {
      category: "RFM",
      name: "RFM Total Score",
      code: "df['rfm_score'] = df['R_score'] + df['F_score'] + df['M_score']",
    },
    {
      category: "RFM",
      name: "RFM Segment String",
      code: "df['rfm_seg'] = df['R_score'].astype(str)+df['F_score'].astype(str)+df['M_score'].astype(str)",
    },
    {
      category: "RFM",
      name: "Champions",
      code: "df['champion'] = ((df['R_score']==5)&(df['F_score']==5)&(df['M_score']==5)).astype(int)",
    },
    {
      category: "RFM",
      name: "At Risk",
      code: "df['at_risk'] = ((df['R_score']<=2)&(df['F_score']>=3)).astype(int)",
    },
    {
      category: "RFM",
      name: "Avg RFM by Segment",
      code: "df.groupby('rfm_seg')[['R','F','M']].mean()",
    },
    {
      category: "RFM",
      name: "RFM K-means Cluster",
      code: "from sklearn.cluster import KMeans; df['rfm_cluster']=KMeans(n_clusters=4).fit_predict(df[['R_score','F_score','M_score']])",
    },
    {
      category: "RFM",
      name: "Weighted RFM",
      code: "df['wRFM'] = 0.15*df['R_score'] + 0.28*df['F_score'] + 0.57*df['M_score']",
    },
    {
      category: "Campaign Performance",
      name: "Conversion Rate",
      code: "df['cvr'] = df['conversions'] / df['clicks']",
    },
    {
      category: "Campaign Performance",
      name: "Revenue per Click",
      code: "df['rpc'] = df['revenue'] / df['clicks']",
    },
    {
      category: "Campaign Performance",
      name: "Gross Profit per Click",
      code: "df['gppc'] = df['gross_profit'] / df['clicks']",
    },
    {
      category: "Campaign Performance",
      name: "Campaign ROI",
      code: "df['roi'] = (df['revenue'] - df['spend']) / df['spend']",
    },
    {
      category: "Campaign Performance",
      name: "Marginal ROAS",
      code: "df['mroas'] = df['revenue'].diff() / df['spend'].diff()",
    },
    {
      category: "Campaign Performance",
      name: "Frequency (impressions/reach)",
      code: "df['freq'] = df['impressions'] / df['reach']",
    },
    {
      category: "Campaign Performance",
      name: "Quality Score Proxy",
      code: "df['qs'] = (df['ctr'] / df['expected_ctr']) * df['landing_score'] * df['ad_relevance']",
    },
    {
      category: "Campaign Performance",
      name: "Ad Fatigue Index",
      code: "df['fatigue'] = df['freq'] * (1 - df['ctr'] / df['ctr'].shift(7))",
    },
    {
      category: "Campaign Performance",
      name: "Impression Share",
      code: "df['imp_share'] = df['impressions'] / df['eligible_impressions']",
    },
    {
      category: "Campaign Performance",
      name: "Lost IS (Budget)",
      code: "df['lost_is_budget'] = df['eligible_impressions'] * df['budget_lost_pct'] / 100",
    },
    {
      category: "Campaign Performance",
      name: "Top-of-Page Rate",
      code: "df['top_rate'] = df['top_impressions'] / df['impressions']",
    },
    {
      category: "Campaign Performance",
      name: "Absolute Top Rate",
      code: "df['abs_top'] = df['abs_top_impressions'] / df['impressions']",
    },
    {
      category: "Campaign Performance",
      name: "Avg Position",
      code: "df['avg_pos'] = (df['impressions'] * df['avg_cpc']).sum() / df['impressions'].sum()",
    },
    {
      category: "Campaign Performance",
      name: "Revenue Attribution",
      code: "df['attr_rev'] = df.groupby('campaign')['revenue'].transform('sum')",
    },
    {
      category: "Campaign Performance",
      name: "Break-Even CPA",
      code: "df['be_cpa'] = df['avg_order_value'] * df['gross_margin_pct']",
    },
    {
      category: "Campaign Performance",
      name: "Efficiency Score",
      code: "df['eff'] = df['revenue'] / (df['spend'] + df['fixed_cost'])",
    },
    {
      category: "SEO / Content",
      name: "Organic Click-Through Rate",
      code: "df['org_ctr'] = df['organic_clicks'] / df['impressions_search']",
    },
    {
      category: "SEO / Content",
      name: "Keyword Ranking Change",
      code: "df['rank_chg'] = df['rank_prev'] - df['rank_curr']",
    },
    {
      category: "SEO / Content",
      name: "Domain Authority Delta",
      code: "df['da_delta'] = df['da'].diff()",
    },
    {
      category: "SEO / Content",
      name: "Backlinks per Page",
      code: "df['bl_per_page'] = df['backlinks'] / df['pages']",
    },
    {
      category: "SEO / Content",
      name: "Organic Traffic Share",
      code: "df['org_share'] = df['organic_sessions'] / df['total_sessions']",
    },
    {
      category: "SEO / Content",
      name: "Content Freshness (days)",
      code: "df['freshness'] = (pd.Timestamp.today() - pd.to_datetime(df['publish_date'])).dt.days",
    },
    {
      category: "SEO / Content",
      name: "Content Engagement Score",
      code: "df['content_eng'] = df['avg_scroll']*0.3 + df['avg_duration']*0.4 + df['ctr']*0.3",
    },
    {
      category: "SEO / Content",
      name: "Pages Indexed",
      code: "df['index_rate'] = df['indexed_pages'] / df['total_pages']",
    },
    {
      category: "SEO / Content",
      name: "Core Web Vitals Score",
      code: "df['cwv'] = (df['lcp_score']+df['fid_score']+df['cls_score'])/3",
    },
    {
      category: "SEO / Content",
      name: "Word Count per Rank",
      code: "df.groupby('rank_bucket')['word_count'].mean()",
    },
    {
      category: "SEO / Content",
      name: "Featured Snippet Rate",
      code: "df['snippet_rate'] = df['featured_snippets'] / df['total_queries']",
    },
    {
      category: "SEO / Content",
      name: "Cannibalization Score",
      code: "df['cann'] = df.groupby('keyword')['page_url'].transform('nunique')",
    },
    {
      category: "Pricing / Offer",
      name: "Discount Rate",
      code: "df['disc_rate'] = df['discount_amount'] / df['original_price']",
    },
    {
      category: "Pricing / Offer",
      name: "Price Elasticity Proxy",
      code: "df['elasticity'] = df['quantity'].pct_change() / df['price'].pct_change()",
    },
    {
      category: "Pricing / Offer",
      name: "Promo Lift",
      code: "df['lift'] = (df['promo_cvr'] - df['baseline_cvr']) / df['baseline_cvr']",
    },
    {
      category: "Pricing / Offer",
      name: "Average Order Value",
      code: "df['aov'] = df['revenue'] / df['orders']",
    },
    {
      category: "Pricing / Offer",
      name: "AOV Growth",
      code: "df['aov_growth'] = df['aov'].pct_change()",
    },
    {
      category: "Pricing / Offer",
      name: "Units per Order",
      code: "df['upo'] = df['units'] / df['orders']",
    },
    {
      category: "Pricing / Offer",
      name: "Coupon Redemption Rate",
      code: "df['coupon_rate'] = df['coupons_used'] / df['coupons_issued']",
    },
    {
      category: "Pricing / Offer",
      name: "Bundle Take Rate",
      code: "df['bundle_rate'] = df['bundle_orders'] / df['total_orders']",
    },
    {
      category: "Pricing / Offer",
      name: "Upsell Revenue Share",
      code: "df['upsell_share'] = df['upsell_rev'] / df['total_rev']",
    },
    {
      category: "Pricing / Offer",
      name: "Cross-sell Revenue Share",
      code: "df['xsell_share'] = df['xsell_rev'] / df['total_rev']",
    },
    {
      category: "A/B Testing",
      name: "Lift %",
      code: "df['lift_pct'] = (df['treatment_cvr'] - df['control_cvr']) / df['control_cvr'] * 100",
    },
    {
      category: "A/B Testing",
      name: "Relative Uplift",
      code: "df['rel_uplift'] = df['treatment_metric'] / df['control_metric'] - 1",
    },
    {
      category: "A/B Testing",
      name: "Z-Score for Proportions",
      code: "p1,p2,n1,n2=df['cvr_t'],df['cvr_c'],df['n_t'],df['n_c']; p=(p1*n1+p2*n2)/(n1+n2); df['z']=(p1-p2)/np.sqrt(p*(1-p)*(1/n1+1/n2))",
    },
    {
      category: "A/B Testing",
      name: "P-Value (two-prop z-test)",
      code: "from scipy.stats import norm; df['p_val']=2*(1-norm.cdf(df['z'].abs()))",
    },
    {
      category: "A/B Testing",
      name: "95% CI Width",
      code: "df['ci_width'] = 1.96 * np.sqrt(df['cvr']*(1-df['cvr'])/df['n'])",
    },
    {
      category: "A/B Testing",
      name: "Statistical Power",
      code: "# use statsmodels: proportion_effectsize then zt_ind_solve_power",
    },
    {
      category: "A/B Testing",
      name: "Sample Size Required",
      code: "# n = (Z_alpha+Z_beta)^2 * 2*p*(1-p) / (p1-p2)^2",
    },
    {
      category: "A/B Testing",
      name: "CUPED Variance Reduction",
      code: "theta=df[['metric','metric_pre']].cov().iloc[0,1]/df['metric_pre'].var(); df['cuped']=df['metric']-theta*df['metric_pre']",
    },
    {
      category: "A/B Testing",
      name: "Novelty Effect Flag",
      code: "df['novelty'] = (df['experiment_day'] <= 3).astype(int)",
    },
    {
      category: "A/B Testing",
      name: "Revenue per User (experiment)",
      code: "df['rpu'] = df.groupby(['variant'])['revenue'].transform('mean')",
    },
    {
      category: "A/B Testing",
      name: "Guardrail Metric Change",
      code: "df['guardrail_delta'] = df['guardrail_treat'] - df['guardrail_ctrl']",
    },
    {
      category: "A/B Testing",
      name: "Minimum Detectable Effect",
      code: "df['mde'] = 2.48 * np.sqrt(df['baseline_cvr']*(1-df['baseline_cvr'])/df['n'])",
    },
    {
      category: "Attribution / Funnel",
      name: "Funnel Drop-off Rate",
      code: "df['dropoff'] = 1 - df['stage_n'] / df['stage_n-1']",
    },
    {
      category: "Attribution / Funnel",
      name: "Funnel Conversion Rate",
      code: "df['funnel_cvr'] = df['conversions'] / df['entries']",
    },
    {
      category: "Attribution / Funnel",
      name: "Top-of-Funnel Volume",
      code: "df['tof'] = df['impressions'] + df['organic_visits']",
    },
    {
      category: "Attribution / Funnel",
      name: "Mid-Funnel Engagement",
      code: "df['mof'] = df['leads'] + df['mqls']",
    },
    {
      category: "Attribution / Funnel",
      name: "Bottom-Funnel Velocity",
      code: "df['bof_vel'] = df['sqls'] / df['days_in_stage']",
    },
    {
      category: "Attribution / Funnel",
      name: "Attribution: Linear",
      code: "df['linear_credit'] = df['revenue'] / df['touchpoints']",
    },
    {
      category: "Attribution / Funnel",
      name: "Attribution: Time Decay",
      code: "df['td_weight'] = 0.5 ** ((df['conversion_date'] - df['touch_date']).dt.days / 7)",
    },
    {
      category: "Attribution / Funnel",
      name: "Revenue by Channel (multi-touch)",
      code: "df.groupby('channel')['td_weight'].sum() / df['td_weight'].sum() * df['total_revenue'].iloc[0]",
    },
    {
      category: "Attribution / Funnel",
      name: "Touchpoints Before Conversion",
      code: "df['tp_count'] = df.groupby('customer_id')['touch_id'].transform('count')",
    },
    {
      category: "Attribution / Funnel",
      name: "Path Length",
      code: "df['path_len'] = df.groupby('conversion_id')['touch_id'].transform('nunique')",
    },
    {
      category: "Attribution / Funnel",
      name: "Assisted Conversions",
      code: "df['assisted'] = df.groupby('channel')['customer_id'].transform('nunique') - df.groupby(['channel','is_last_touch'])['customer_id'].transform('nunique')",
    },
    {
      category: "Geographic / Demographic",
      name: "Revenue per Region",
      code: "df.groupby('region')['revenue'].sum()",
    },
    {
      category: "Geographic / Demographic",
      name: "Market Penetration",
      code: "df['penetration'] = df['customers'] / df['market_size']",
    },
    {
      category: "Geographic / Demographic",
      name: "Revenue per Capita",
      code: "df['rev_per_capita'] = df['revenue'] / df['population']",
    },
    {
      category: "Geographic / Demographic",
      name: "Age Group Conversion Rate",
      code: "df.groupby('age_group')['converted'].mean()",
    },
    {
      category: "Geographic / Demographic",
      name: "Gender Split Revenue",
      code: "df.groupby('gender')['revenue'].sum() / df['revenue'].sum()",
    },
    {
      category: "Geographic / Demographic",
      name: "Urban vs Rural Mix",
      code: "df['urban_share'] = df[df['location_type']=='urban'].shape[0] / df.shape[0]",
    },
    {
      category: "Geographic / Demographic",
      name: "Income Quintile LTV",
      code: "df.groupby('income_quintile')['ltv'].mean()",
    },
    {
      category: "Geographic / Demographic",
      name: "Geo Expansion Score",
      code: "df['geo_score'] = df['market_growth'] * (1 - df['penetration'])",
    },
    {
      category: "Geographic / Demographic",
      name: "Distance to Store (km)",
      code: "# haversine: from haversine import haversine; df['dist']=df.apply(lambda r:haversine(r['cust_lat','cust_lon'],r['store_lat','store_lon']),axis=1)",
    },
    {
      category: "Brand / NPS",
      name: "NPS Score",
      code: "df['nps'] = df[df['score']>=9].shape[0]/df.shape[0]*100 - df[df['score']<=6].shape[0]/df.shape[0]*100",
    },
    {
      category: "Brand / NPS",
      name: "CSAT Score",
      code: "df['csat'] = df[df['satisfaction']>=4].shape[0] / df.shape[0] * 100",
    },
    {
      category: "Brand / NPS",
      name: "CES Score",
      code: "df['ces'] = df['effort_score'].mean()",
    },
    {
      category: "Brand / NPS",
      name: "Brand Awareness Index",
      code: "df['brand_aware'] = df['unaided_recall'] / df['total_surveyed']",
    },
    {
      category: "Brand / NPS",
      name: "Brand Preference Share",
      code: "df['brand_pref'] = df['preferred_brand_count'] / df['total_surveyed']",
    },
    {
      category: "Brand / NPS",
      name: "Review Score Avg",
      code: "df['avg_rating'] = df['total_stars'] / df['num_reviews']",
    },
    {
      category: "Brand / NPS",
      name: "Review Volume Growth",
      code: "df['review_growth'] = df['num_reviews'].pct_change()",
    },
    {
      category: "Brand / NPS",
      name: "NPS Promoter Rate",
      code: "df['promoter_rate'] = (df['score'] >= 9).mean()",
    },
    {
      category: "Brand / NPS",
      name: "NPS Detractor Rate",
      code: "df['detractor_rate'] = (df['score'] <= 6).mean()",
    },
    {
      category: "Brand / NPS",
      name: "Word-of-Mouth Factor",
      code: "df['wom'] = df['referred_customers'] / df['total_customers']",
    },
    {
      category: "Brand / NPS",
      name: "Social Mention Growth",
      code: "df['mention_growth'] = df['mentions'].pct_change()",
    },
    {
      category: "Brand / NPS",
      name: "Earned Media Value",
      code: "df['emv'] = df['organic_impressions'] * df['cpm'] / 1000",
    },
    {
      category: "Market Mix Modeling",
      name: "Adstock (carry-over)",
      code: "df['adstock'] = df['spend'].ewm(alpha=0.5).mean()",
    },
    {
      category: "Market Mix Modeling",
      name: "Saturation (Hill function)",
      code: "df['sat'] = df['spend']**0.6 / (df['spend']**0.6 + 50**0.6)",
    },
    {
      category: "Market Mix Modeling",
      name: "Lagged Spend 1w",
      code: "df['spend_lag1w'] = df['spend'].shift(7)",
    },
    {
      category: "Market Mix Modeling",
      name: "Lagged Spend 2w",
      code: "df['spend_lag2w'] = df['spend'].shift(14)",
    },
    {
      category: "Market Mix Modeling",
      name: "Cumulative Adstock",
      code: "df['cumstock'] = df['adstock'].cumsum()",
    },
    {
      category: "Market Mix Modeling",
      name: "Diminishing Returns Proxy",
      code: "df['dim_ret'] = np.log1p(df['spend'])",
    },
    {
      category: "Market Mix Modeling",
      name: "Share of Budget by Channel",
      code: "df['budget_share'] = df['channel_spend'] / df['total_spend']",
    },
    {
      category: "Market Mix Modeling",
      name: "TV GRP Impressions",
      code: "df['tv_imp'] = df['grps'] * df['target_universe'] / 100",
    },
    {
      category: "Market Mix Modeling",
      name: "Spend per Incremental Sale",
      code: "df['spend_per_incr'] = df['spend'] / df['incremental_units']",
    },
    {
      category: "Market Mix Modeling",
      name: "Media Efficiency Ratio",
      code: "df['mer'] = df['revenue'] / df['total_media_spend']",
    },
    {
      category: "Segmentation",
      name: "K-means Segment",
      code: "from sklearn.cluster import KMeans; df['segment']=KMeans(n_clusters=5).fit_predict(X_scaled)",
    },
    {
      category: "Segmentation",
      name: "Purchase Frequency Tier",
      code: "df['freq_tier'] = pd.qcut(df['F'], q=4, labels=['rare','occasional','regular','loyal'])",
    },
    {
      category: "Segmentation",
      name: "High Value Flag",
      code: "df['high_val'] = (df['M'] >= df['M'].quantile(0.8)).astype(int)",
    },
    {
      category: "Segmentation",
      name: "New vs Returning",
      code: "df['is_new'] = (df['F'] == 1).astype(int)",
    },
    {
      category: "Segmentation",
      name: "Subscriber Status",
      code: "df['subscribed'] = df['email_status'].map({'active':1,'unsubscribed':0,'bounced':0})",
    },
    {
      category: "Segmentation",
      name: "Product Category Affinity",
      code: "df['top_cat'] = df.groupby('customer_id')['category'].transform(lambda x: x.mode()[0])",
    },
    {
      category: "Segmentation",
      name: "Device Type Dummy",
      code: "df = pd.get_dummies(df, columns=['device_type'], drop_first=True)",
    },
    {
      category: "Segmentation",
      name: "Channel Preference",
      code: "df['pref_ch'] = df.groupby('customer_id')['channel'].transform(lambda x: x.mode()[0])",
    },
    {
      category: "Segmentation",
      name: "Recency Tier",
      code: "df['rec_tier'] = pd.cut(df['days_since'], bins=[0,7,30,90,365,9999], labels=['active','warm','cooling','dormant','lapsed'])",
    },
    {
      category: "Segmentation",
      name: "Spend Percentile",
      code: "df['spend_pct'] = df['M'].rank(pct=True)",
    },
    {
      category: "Encoding & Time",
      name: "Day of Week",
      code: "df['dow'] = pd.to_datetime(df['date']).dt.dayofweek",
    },
    {
      category: "Encoding & Time",
      name: "Hour of Day",
      code: "df['hour'] = pd.to_datetime(df['timestamp']).dt.hour",
    },
    {
      category: "Encoding & Time",
      name: "Is Weekend",
      code: "df['is_wknd'] = (df['dow'] >= 5).astype(int)",
    },
    {
      category: "Encoding & Time",
      name: "Month of Year",
      code: "df['month'] = pd.to_datetime(df['date']).dt.month",
    },
    {
      category: "Encoding & Time",
      name: "Seasonal Index",
      code: "df['seas_idx'] = df.groupby('month')['revenue'].transform('mean') / df['revenue'].mean()",
    },
    {
      category: "Encoding & Time",
      name: "Holiday Flag",
      code: "holidays=['2024-12-25','2024-01-01']; df['holiday']=(df['date'].isin(holidays)).astype(int)",
    },
    {
      category: "Encoding & Time",
      name: "Days to Next Holiday",
      code: "df['days_to_hol'] = df['next_holiday'] - pd.to_datetime(df['date'])",
    },
    {
      category: "Encoding & Time",
      name: "Fiscal Quarter",
      code: "df['fq'] = pd.to_datetime(df['date']).dt.to_period('Q-SEP')",
    },
    {
      category: "Encoding & Time",
      name: "Campaign Age (days)",
      code: "df['camp_age'] = (pd.to_datetime(df['date']) - pd.to_datetime(df['campaign_start'])).dt.days",
    },
    {
      category: "Encoding & Time",
      name: "Cyclical Month Sin",
      code: "df['month_sin'] = np.sin(2*np.pi*df['month']/12)",
    },
    {
      category: "Encoding & Time",
      name: "Cyclical Month Cos",
      code: "df['month_cos'] = np.cos(2*np.pi*df['month']/12)",
    },
    {
      category: "Encoding & Time",
      name: "Cyclical DOW Sin",
      code: "df['dow_sin'] = np.sin(2*np.pi*df['dow']/7)",
    },
    {
      category: "Encoding & Time",
      name: "Rolling 4w Revenue",
      code: "df['roll4w_rev'] = df['revenue'].rolling(28).sum()",
    },
    {
      category: "Encoding & Time",
      name: "YoY Revenue Growth",
      code: "df['yoy_rev'] = df.groupby('month')['revenue'].pct_change()",
    },
    {
      category: "Encoding & Time",
      name: "MoM Revenue Growth",
      code: "df['mom_rev'] = df['revenue'].pct_change()",
    },
    {
      category: "SaaS / Subscription",
      name: "MRR",
      code: "df['mrr'] = df['active_subs'] * df['avg_monthly_fee']",
    },
    {
      category: "SaaS / Subscription",
      name: "ARR",
      code: "df['arr'] = df['mrr'] * 12",
    },
    {
      category: "SaaS / Subscription",
      name: "MRR Growth Rate",
      code: "df['mrr_growth'] = df['mrr'].pct_change()",
    },
    {
      category: "SaaS / Subscription",
      name: "Expansion MRR",
      code: "df['expansion_mrr'] = df['upsell_mrr'] + df['cross_sell_mrr']",
    },
    {
      category: "SaaS / Subscription",
      name: "Contraction MRR",
      code: "df['contraction_mrr'] = df['downgrade_mrr'] + df['partial_churn_mrr']",
    },
    {
      category: "SaaS / Subscription",
      name: "Net MRR Change",
      code: "df['net_mrr_chg'] = df['new_mrr'] + df['expansion_mrr'] - df['contraction_mrr'] - df['churn_mrr']",
    },
    {
      category: "SaaS / Subscription",
      name: "Quick Ratio (SaaS)",
      code: "df['quick_ratio'] = (df['new_mrr'] + df['expansion_mrr']) / (df['churn_mrr'] + df['contraction_mrr'])",
    },
    {
      category: "SaaS / Subscription",
      name: "Product-Qualified Lead Score",
      code: "df['pql_score'] = df['feature_depth'] * 0.4 + df['usage_freq'] * 0.4 + df['team_size'] * 0.2",
    },
    {
      category: "SaaS / Subscription",
      name: "Time to Value (TTV)",
      code: "df['ttv'] = (df['value_moment_date'] - df['signup_date']).dt.days",
    },
    {
      category: "SaaS / Subscription",
      name: "Feature Adoption Rate",
      code: "df['feature_adopt'] = df['users_using_feature'] / df['total_users']",
    },
    {
      category: "SaaS / Subscription",
      name: "DAU/MAU Ratio",
      code: "df['stickiness'] = df['dau'] / df['mau']",
    },
    {
      category: "SaaS / Subscription",
      name: "Seats Utilization",
      code: "df['seat_util'] = df['active_seats'] / df['purchased_seats']",
    },
    {
      category: "SaaS / Subscription",
      name: "Logo Churn Rate",
      code: "df['logo_churn'] = df['churned_accounts'] / df['total_accounts']",
    },
    {
      category: "SaaS / Subscription",
      name: "Net Dollar Retention",
      code: "df['ndr'] = (df['mrr_12m_ago'] + df['expansion'] - df['contraction'] - df['churn_rev']) / df['mrr_12m_ago']",
    },
  ],
  HEALTHCARE: [
    {
      category: "Clinical / Vitals",
      name: "BMI",
      code: "df['bmi'] = df['weight_kg'] / (df['height_m'] ** 2)",
    },
    {
      category: "Clinical / Vitals",
      name: "BMI Category",
      code: "df['bmi_cat'] = pd.cut(df['bmi'], bins=[0,18.5,25,30,100], labels=['underweight','normal','overweight','obese'])",
    },
    {
      category: "Clinical / Vitals",
      name: "MAP (Mean Arterial Pressure)",
      code: "df['map'] = df['dbp'] + (df['sbp'] - df['dbp']) / 3",
    },
    {
      category: "Clinical / Vitals",
      name: "Pulse Pressure",
      code: "df['pp'] = df['sbp'] - df['dbp']",
    },
    {
      category: "Clinical / Vitals",
      name: "Shock Index",
      code: "df['shock_idx'] = df['heart_rate'] / df['sbp']",
    },
    {
      category: "Clinical / Vitals",
      name: "SpO2 Below 95 Flag",
      code: "df['low_spo2'] = (df['spo2'] < 95).astype(int)",
    },
    {
      category: "Clinical / Vitals",
      name: "Temperature Above 38",
      code: "df['fever'] = (df['temp_c'] > 38).astype(int)",
    },
    {
      category: "Clinical / Vitals",
      name: "Respiratory Rate Flag",
      code: "df['high_rr'] = (df['rr'] > 20).astype(int)",
    },
    {
      category: "Clinical / Vitals",
      name: "Tachycardia Flag",
      code: "df['tachy'] = (df['heart_rate'] > 100).astype(int)",
    },
    {
      category: "Clinical / Vitals",
      name: "NEWS2 Score",
      code: "# sum of weighted vital sign scores; df['news2']=df[['rr_score','spo2_score','sbp_score','hr_score','temp_score','avpu_score']].sum(axis=1)",
    },
    {
      category: "Clinical / Vitals",
      name: "eGFR (CKD-EPI)",
      code: "# complex; df['egfr'] = 141 * min(Scr/kappa, 1)**alpha * max(Scr/kappa, 1)**-1.209 * 0.993**age * gender_factor",
    },
    {
      category: "Clinical / Vitals",
      name: "Creatinine Change",
      code: "df['cr_chg'] = df['creatinine'] - df['creatinine'].shift(1)",
    },
    {
      category: "Clinical / Vitals",
      name: "HbA1c to Estimated Avg Glucose",
      code: "df['eag'] = 28.7 * df['hba1c'] - 46.7",
    },
    {
      category: "Clinical / Vitals",
      name: "Corrected Calcium",
      code: "df['corr_ca'] = df['calcium'] + 0.8 * (4 - df['albumin'])",
    },
    {
      category: "Clinical / Vitals",
      name: "LDL (Friedewald)",
      code: "df['ldl'] = df['total_chol'] - df['hdl'] - df['triglycerides'] / 5",
    },
    {
      category: "Clinical / Vitals",
      name: "Non-HDL Cholesterol",
      code: "df['non_hdl'] = df['total_chol'] - df['hdl']",
    },
    {
      category: "Clinical / Vitals",
      name: "Anion Gap",
      code: "df['ag'] = df['sodium'] - (df['chloride'] + df['bicarbonate'])",
    },
    {
      category: "Clinical / Vitals",
      name: "Osmolality",
      code: "df['osm'] = 2*df['sodium'] + df['glucose']/18 + df['bun']/2.8",
    },
    {
      category: "Clinical / Vitals",
      name: "Troponin Delta",
      code: "df['trop_delta'] = df['troponin'] - df['troponin'].shift(1)",
    },
    {
      category: "Clinical / Vitals",
      name: "GCS Total",
      code: "df['gcs'] = df['gcs_e'] + df['gcs_v'] + df['gcs_m']",
    },
    {
      category: "Clinical / Vitals",
      name: "SOFA Score",
      code: "df['sofa'] = df[['resp_sofa','coag_sofa','liver_sofa','cv_sofa','cns_sofa','renal_sofa']].sum(axis=1)",
    },
    {
      category: "Clinical / Vitals",
      name: "qSOFA Score",
      code: "df['qsofa'] = df['rr_flag'] + df['sbp_flag'] + df['gcs_flag']",
    },
    {
      category: "Clinical / Vitals",
      name: "APACHE II Proxy",
      code: "df['apache2'] = df[apache_cols].sum(axis=1)",
    },
    {
      category: "Clinical / Vitals",
      name: "Charlson Comorbidity Index",
      code: "df['cci'] = df[comorbidity_cols].multiply(weights).sum(axis=1)",
    },
    {
      category: "Clinical / Vitals",
      name: "Elixhauser Score",
      code: "df['elix'] = df[elix_cols].sum(axis=1)",
    },
    {
      category: "Clinical / Vitals",
      name: "Frailty Score",
      code: "df['frailty'] = df[frailty_items].mean(axis=1)",
    },
    {
      category: "Lab Values",
      name: "WBC Differential",
      code: "df['neutrophil_pct'] = df['neutrophils'] / df['wbc']",
    },
    {
      category: "Lab Values",
      name: "Neutrophil-to-Lymphocyte Ratio",
      code: "df['nlr'] = df['neutrophils'] / df['lymphocytes']",
    },
    {
      category: "Lab Values",
      name: "Platelet-to-Lymphocyte Ratio",
      code: "df['plr'] = df['platelets'] / df['lymphocytes']",
    },
    {
      category: "Lab Values",
      name: "Lymphocyte-to-Monocyte Ratio",
      code: "df['lmr'] = df['lymphocytes'] / df['monocytes']",
    },
    {
      category: "Lab Values",
      name: "Hemoglobin Change",
      code: "df['hgb_delta'] = df.groupby('patient_id')['hemoglobin'].diff()",
    },
    {
      category: "Lab Values",
      name: "Ferritin Log Transform",
      code: "df['log_ferritin'] = np.log1p(df['ferritin'])",
    },
    {
      category: "Lab Values",
      name: "CRP Above 10",
      code: "df['high_crp'] = (df['crp'] > 10).astype(int)",
    },
    {
      category: "Lab Values",
      name: "Procalcitonin Flag",
      code: "df['pct_flag'] = pd.cut(df['procalcitonin'], bins=[0,0.5,2,10,9999], labels=['normal','borderline','sepsis_likely','sepsis'])",
    },
    {
      category: "Lab Values",
      name: "INR Flag",
      code: "df['inr_flag'] = (df['inr'] > 1.5).astype(int)",
    },
    {
      category: "Lab Values",
      name: "Lab Value Z-Score by Test",
      code: "df['lab_z'] = df.groupby('test_name')['result'].transform(lambda x:(x-x.mean())/x.std())",
    },
    {
      category: "Lab Values",
      name: "Lab Change from Baseline",
      code: "df['lab_chg'] = df['result'] - df.groupby(['patient_id','test_name'])['result'].transform('first')",
    },
    {
      category: "Lab Values",
      name: "Days Since Last Lab",
      code: "df['days_since_lab'] = df.groupby(['patient_id','test_name'])['date'].diff().dt.days",
    },
    {
      category: "Lab Values",
      name: "Abnormal Result Flag",
      code: "df['abnormal'] = ((df['result'] < df['low_ref']) | (df['result'] > df['high_ref'])).astype(int)",
    },
    {
      category: "Lab Values",
      name: "Lab Trend (slope 3 readings)",
      code: "df['lab_trend'] = df.groupby('patient_id')['result'].transform(lambda x: np.polyfit(range(len(x)),x,1)[0] if len(x)>=3 else np.nan)",
    },
    {
      category: "Patient History",
      name: "Number of Comorbidities",
      code: "df['num_comorbid'] = df[comorbidity_cols].sum(axis=1)",
    },
    {
      category: "Patient History",
      name: "Number of Medications",
      code: "df['num_meds'] = df.groupby('patient_id')['medication_id'].transform('nunique')",
    },
    {
      category: "Patient History",
      name: "Polypharmacy Flag (≥5 meds)",
      code: "df['polypharm'] = (df['num_meds'] >= 5).astype(int)",
    },
    {
      category: "Patient History",
      name: "Prior Admissions Count",
      code: "df['prior_admit'] = df.groupby('patient_id')['admission_id'].transform('cumcount')",
    },
    {
      category: "Patient History",
      name: "Prior ED Visits",
      code: "df['prior_ed'] = df[df['visit_type']=='ED'].groupby('patient_id').cumcount()",
    },
    {
      category: "Patient History",
      name: "Days Since Last Admission",
      code: "df['days_since_adm'] = df.groupby('patient_id')['admit_date'].diff().dt.days",
    },
    {
      category: "Patient History",
      name: "30-day Readmission Flag",
      code: "df['readmit30'] = (df['days_since_adm'] <= 30).astype(int)",
    },
    {
      category: "Patient History",
      name: "LOS (Length of Stay)",
      code: "df['los'] = (df['discharge_date'] - df['admit_date']).dt.days",
    },
    {
      category: "Patient History",
      name: "ICU Hours",
      code: "df['icu_hrs'] = (df['icu_end'] - df['icu_start']).dt.total_seconds() / 3600",
    },
    {
      category: "Patient History",
      name: "Ventilator Days",
      code: "df['vent_days'] = (df['vent_end'] - df['vent_start']).dt.days",
    },
    {
      category: "Patient History",
      name: "Age at Admission",
      code: "df['age_admit'] = (df['admit_date'] - df['dob']).dt.days // 365",
    },
    {
      category: "Patient History",
      name: "Pediatric Flag",
      code: "df['pediatric'] = (df['age_admit'] < 18).astype(int)",
    },
    {
      category: "Patient History",
      name: "Elderly Flag",
      code: "df['elderly'] = (df['age_admit'] >= 65).astype(int)",
    },
    {
      category: "Patient History",
      name: "Surgical History Count",
      code: "df['surg_count'] = df.groupby('patient_id')['surgery_id'].transform('nunique')",
    },
    {
      category: "Patient History",
      name: "Allergy Count",
      code: "df['allergy_cnt'] = df.groupby('patient_id')['allergy_id'].transform('nunique')",
    },
    {
      category: "Patient History",
      name: "Active Problem Count",
      code: "df['prob_cnt'] = df.groupby('patient_id')['problem_id'].transform('nunique')",
    },
    {
      category: "Mortality & Risk",
      name: "Mortality Risk (logistic proxy)",
      code: "df['mort_risk'] = 1 / (1 + np.exp(-(df['sofa']*0.3 + df['age']*0.02 - 5)))",
    },
    {
      category: "Mortality & Risk",
      name: "MEWS Score",
      code: "df['mews'] = df[['sbp_score','hr_score','rr_score','temp_score','avpu_score']].sum(axis=1)",
    },
    {
      category: "Mortality & Risk",
      name: "Sepsis Flag (Sepsis-3)",
      code: "df['sepsis'] = ((df['sofa'] >= 2) & df['infection_suspected']).astype(int)",
    },
    {
      category: "Mortality & Risk",
      name: "Readmission Risk Score",
      code: "df['readmit_risk'] = df[['prior_admit','num_comorbid','age_admit','los']].dot([0.3,0.25,0.02,0.1])",
    },
    {
      category: "Mortality & Risk",
      name: "AKI Stage",
      code: "df['aki'] = pd.cut(df['cr_chg'], bins=[-99,0.2,0.5,3,99], labels=[0,1,2,3]).astype(int)",
    },
    {
      category: "Mortality & Risk",
      name: "Fall Risk Score (Morse)",
      code: "df['morse'] = df[morse_cols].dot(morse_weights)",
    },
    {
      category: "Mortality & Risk",
      name: "Pressure Injury Risk (Braden)",
      code: "df['braden'] = df[braden_cols].sum(axis=1)",
    },
    {
      category: "Mortality & Risk",
      name: "Delirium Risk (CAM)",
      code: "df['cam_pos'] = ((df['acute_onset']==1)&(df['inattention']==1)&((df['disorg_thinking']==1)|(df['altered_consc']==1))).astype(int)",
    },
    {
      category: "Mortality & Risk",
      name: "DVT Risk (Caprini)",
      code: "df['caprini'] = df[caprini_cols].dot(caprini_weights)",
    },
    {
      category: "Mortality & Risk",
      name: "Bleeding Risk (HAS-BLED)",
      code: "df['hasbled'] = df[hasbled_cols].sum(axis=1)",
    },
    {
      category: "Mortality & Risk",
      name: "Stroke Risk (CHADS-VASc)",
      code: "df['chadsvasc'] = df[['chf_flag','htn_flag','age75_flag','dm_flag','stroke_flag','vasc_flag','age65_flag','female_flag']].dot([1,1,2,1,2,1,1,1])",
    },
    {
      category: "Mortality & Risk",
      name: "Frailty-adjusted LOS",
      code: "df['frailty_los'] = df['los'] * df['frailty']",
    },
    {
      category: "Operational",
      name: "Bed Occupancy Rate",
      code: "df['occ_rate'] = df['occupied_beds'] / df['total_beds']",
    },
    {
      category: "Operational",
      name: "Avg LOS by DRG",
      code: "df.groupby('drg_code')['los'].mean()",
    },
    {
      category: "Operational",
      name: "Readmission Rate 30d",
      code: "df['rm_rate'] = df['readmit30'].mean()",
    },
    {
      category: "Operational",
      name: "Discharge Disposition Encoding",
      code: "df = pd.get_dummies(df, columns=['discharge_to'], drop_first=True)",
    },
    {
      category: "Operational",
      name: "Nurse-to-Patient Ratio",
      code: "df['npt_ratio'] = df['nurses'] / df['patients']",
    },
    {
      category: "Operational",
      name: "Wait Time (ED)",
      code: "df['wait_time'] = (df['provider_seen'] - df['triage_time']).dt.total_seconds() / 60",
    },
    {
      category: "Operational",
      name: "Throughput per Hour",
      code: "df['throughput'] = df['discharges'] / df['hours']",
    },
    {
      category: "Operational",
      name: "Overtime Hours Flag",
      code: "df['overtime'] = (df['shift_hours'] > 8).astype(int)",
    },
    {
      category: "Operational",
      name: "Cost per Admission",
      code: "df['cpa'] = df['total_cost'] / df['admissions']",
    },
    {
      category: "Operational",
      name: "Revenue per Case",
      code: "df['rpc'] = df['total_revenue'] / df['cases']",
    },
    {
      category: "Operational",
      name: "Contribution Margin per Case",
      code: "df['cm'] = (df['revenue'] - df['variable_cost']) / df['cases']",
    },
    {
      category: "Operational",
      name: "OR Utilization Rate",
      code: "df['or_util'] = df['or_used_mins'] / df['or_available_mins']",
    },
    {
      category: "Operational",
      name: "Case Mix Index",
      code: "df['cmi'] = df['drg_weight'].mean()",
    },
    {
      category: "Operational",
      name: "Denied Claims Rate",
      code: "df['denial_rate'] = df['denied_claims'] / df['total_claims']",
    },
    {
      category: "Operational",
      name: "Clean Claim Rate",
      code: "df['clean_rate'] = df['clean_claims'] / df['total_claims']",
    },
    {
      category: "Operational",
      name: "Days in AR",
      code: "df['dar'] = df['accounts_receivable'] / (df['gross_charges'] / 365)",
    },
    {
      category: "Operational",
      name: "Payer Mix (% Medicare)",
      code: "df['medicare_share'] = (df['payer']=='Medicare').mean()",
    },
    {
      category: "Operational",
      name: "Medication Error Rate",
      code: "df['med_err_rate'] = df['med_errors'] / df['med_administrations']",
    },
    {
      category: "Operational",
      name: "HCAHPS Score Avg",
      code: "df['hcahps_avg'] = df[hcahps_cols].mean(axis=1)",
    },
    {
      category: "Operational",
      name: "Staff Turnover Rate",
      code: "df['turnover'] = df['staff_left'] / df['avg_headcount']",
    },
    {
      category: "Epidemiology",
      name: "Incidence Rate",
      code: "df['incidence'] = df['new_cases'] / df['population_at_risk'] * 1000",
    },
    {
      category: "Epidemiology",
      name: "Prevalence",
      code: "df['prevalence'] = df['total_cases'] / df['population']",
    },
    {
      category: "Epidemiology",
      name: "Case Fatality Rate",
      code: "df['cfr'] = df['deaths'] / df['confirmed_cases']",
    },
    {
      category: "Epidemiology",
      name: "Infection Fatality Rate",
      code: "df['ifr'] = df['deaths'] / df['estimated_infections']",
    },
    {
      category: "Epidemiology",
      name: "Reproduction Number R0 (proxy)",
      code: "df['r0_proxy'] = df['new_cases'] / df['new_cases'].shift(7)",
    },
    {
      category: "Epidemiology",
      name: "Attack Rate",
      code: "df['attack_rate'] = df['ill'] / df['exposed']",
    },
    {
      category: "Epidemiology",
      name: "Relative Risk",
      code: "df['rr'] = (df['events_exposed']/df['exposed']) / (df['events_unexposed']/df['unexposed'])",
    },
    {
      category: "Epidemiology",
      name: "Odds Ratio",
      code: "df['or'] = (df['cases_exposed']*df['controls_unexposed']) / (df['controls_exposed']*df['cases_unexposed'])",
    },
    {
      category: "Epidemiology",
      name: "Attributable Risk",
      code: "df['ar'] = df['incidence_exposed'] - df['incidence_unexposed']",
    },
    {
      category: "Epidemiology",
      name: "Number Needed to Treat",
      code: "df['nnt'] = 1 / df['absolute_risk_reduction']",
    },
    {
      category: "Epidemiology",
      name: "Vaccine Efficacy",
      code: "df['ve'] = 1 - df['rr']",
    },
    {
      category: "Epidemiology",
      name: "Herd Immunity Threshold",
      code: "df['herd'] = 1 - 1/df['r0']",
    },
    {
      category: "Epidemiology",
      name: "Doubling Time",
      code: "df['doubling'] = np.log(2) / np.log(df['growth_rate'])",
    },
    {
      category: "Epidemiology",
      name: "Test Positivity Rate",
      code: "df['pos_rate'] = df['positive_tests'] / df['total_tests']",
    },
    {
      category: "Epidemiology",
      name: "Sensitivity (Recall)",
      code: "df['sensitivity'] = df['tp'] / (df['tp'] + df['fn'])",
    },
    {
      category: "Epidemiology",
      name: "Specificity",
      code: "df['specificity'] = df['tn'] / (df['tn'] + df['fp'])",
    },
    {
      category: "Epidemiology",
      name: "PPV",
      code: "df['ppv'] = df['tp'] / (df['tp'] + df['fp'])",
    },
    {
      category: "Epidemiology",
      name: "NPV",
      code: "df['npv'] = df['tn'] / (df['tn'] + df['fn'])",
    },
    {
      category: "Epidemiology",
      name: "AUC-ROC Proxy",
      code: "from sklearn.metrics import roc_auc_score; roc_auc_score(df['label'], df['score'])",
    },
    {
      category: "Epidemiology",
      name: "Brier Score",
      code: "df['brier'] = (df['prob'] - df['label'])**2",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Variant Allele Frequency",
      code: "df['vaf'] = df['alt_reads'] / df['total_reads']",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Copy Number Ratio",
      code: "df['cnr'] = df['tumor_coverage'] / df['normal_coverage']",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Tumor Mutational Burden",
      code: "df['tmb'] = df['somatic_mutations'] / df['exome_size_mb']",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Gene Expression Z-Score",
      code: "df['expr_z'] = df.groupby('gene')['expression'].transform(lambda x:(x-x.mean())/x.std())",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Polygenic Risk Score",
      code: "df['prs'] = (df[snp_cols] * effect_sizes).sum(axis=1)",
    },
    {
      category: "Genomics / Biomarkers",
      name: "HLA Type Encoding",
      code: "df = pd.get_dummies(df, columns=['hla_type'])",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Biomarker Percentile",
      code: "df['bm_pct'] = df['biomarker'].rank(pct=True)",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Log2 Fold Change",
      code: "df['lfc'] = np.log2(df['treated'] / df['control'])",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Methylation Beta Value",
      code: "df['beta'] = df['m_intensity'] / (df['m_intensity'] + df['u_intensity'] + 100)",
    },
    {
      category: "Genomics / Biomarkers",
      name: "Protein Abundance Norm",
      code: "df['prot_norm'] = df['intensity'] / df['total_protein_intensity']",
    },
    {
      category: "Imaging & Signal",
      name: "Lesion Volume",
      code: "df['vol'] = df['length'] * df['width'] * df['height'] * 0.5236",
    },
    {
      category: "Imaging & Signal",
      name: "Bi-rads Score Encoding",
      code: "df['birads_num'] = df['birads'].str.extract(r'(\\d)').astype(int)",
    },
    {
      category: "Imaging & Signal",
      name: "ECG RR Interval",
      code: "df['rr_ms'] = 60000 / df['heart_rate']",
    },
    {
      category: "Imaging & Signal",
      name: "QTc (Bazett)",
      code: "df['qtc'] = df['qt_ms'] / np.sqrt(df['rr_ms'] / 1000)",
    },
    {
      category: "Imaging & Signal",
      name: "ST Elevation Flag",
      code: "df['stemi'] = (df['st_elevation_mm'] >= 1).astype(int)",
    },
    {
      category: "Imaging & Signal",
      name: "HRV (RMSSD)",
      code: "df['rmssd'] = np.sqrt(np.mean(np.diff(df['rr_intervals'])**2))",
    },
    {
      category: "Imaging & Signal",
      name: "SpO2 Rolling Mean",
      code: "df['spo2_roll'] = df['spo2'].rolling(5).mean()",
    },
    {
      category: "Imaging & Signal",
      name: "Waveform Peak Detection",
      code: "from scipy.signal import find_peaks; peaks,_=find_peaks(df['signal'],height=0)",
    },
    {
      category: "Medication / Pharmacy",
      name: "Daily Defined Dose (DDD)",
      code: "df['ddd'] = df['prescribed_dose'] / df['ddd_standard']",
    },
    {
      category: "Medication / Pharmacy",
      name: "Medication Adherence Rate",
      code: "df['adherence'] = df['doses_taken'] / df['doses_prescribed']",
    },
    {
      category: "Medication / Pharmacy",
      name: "MPR (Medication Possession Ratio)",
      code: "df['mpr'] = df['days_supply'] / df['follow_up_days']",
    },
    {
      category: "Medication / Pharmacy",
      name: "PDC (Proportion Days Covered)",
      code: "df['pdc'] = df['covered_days'] / df['total_days']",
    },
    {
      category: "Medication / Pharmacy",
      name: "Drug Interaction Flag",
      code: "df['interaction'] = df.apply(lambda r: r['drug1'] in interaction_dict.get(r['drug2'],[]), axis=1).astype(int)",
    },
    {
      category: "Medication / Pharmacy",
      name: "Dose Deviation",
      code: "df['dose_dev'] = (df['actual_dose'] - df['prescribed_dose']) / df['prescribed_dose']",
    },
    {
      category: "Medication / Pharmacy",
      name: "Refill Days Late",
      code: "df['refill_late'] = (df['refill_date'] - df['expected_refill']).dt.days",
    },
    {
      category: "Medication / Pharmacy",
      name: "High-Risk Medication Flag",
      code: "df['high_risk_med'] = df['medication'].isin(high_risk_list).astype(int)",
    },
    {
      category: "Medication / Pharmacy",
      name: "Opioid MME per Day",
      code: "df['mme_day'] = df['dose_mg'] * df['mme_factor'] / df['supply_days']",
    },
    {
      category: "Medication / Pharmacy",
      name: "Antibiotic Days of Therapy",
      code: "df['dot'] = df.groupby(['patient_id','antibiotic'])['admin_date'].transform('nunique')",
    },
    {
      category: "Mental Health",
      name: "PHQ-9 Score",
      code: "df['phq9'] = df[phq9_cols].sum(axis=1)",
    },
    {
      category: "Mental Health",
      name: "PHQ-9 Severity",
      code: "df['phq9_sev'] = pd.cut(df['phq9'], bins=[-1,4,9,14,19,27], labels=['none','mild','moderate','mod_severe','severe'])",
    },
    {
      category: "Mental Health",
      name: "GAD-7 Score",
      code: "df['gad7'] = df[gad7_cols].sum(axis=1)",
    },
    {
      category: "Mental Health",
      name: "Mood Change (EHR)",
      code: "df['mood_delta'] = df.groupby('patient_id')['mood_score'].diff()",
    },
    {
      category: "Mental Health",
      name: "Treatment Non-Adherence Flag",
      code: "df['non_adhere'] = (df['pdc'] < 0.8).astype(int)",
    },
    {
      category: "Population Health",
      name: "Risk Stratification Tier",
      code: "df['risk_tier'] = pd.qcut(df['risk_score'], q=4, labels=['low','medium','high','critical'])",
    },
    {
      category: "Population Health",
      name: "Preventable Hospitalization Rate",
      code: "df['prev_hosp'] = df['avoidable_admits'] / df['total_admits']",
    },
    {
      category: "Population Health",
      name: "Care Gap Count",
      code: "df['care_gaps'] = df[care_gap_cols].sum(axis=1)",
    },
    {
      category: "Population Health",
      name: "SDOH Risk Score",
      code: "df['sdoh_risk'] = df[['food_insecurity','housing_instability','transport_barrier','low_income']].sum(axis=1)",
    },
    {
      category: "Population Health",
      name: "ED Utilization Rate",
      code: "df['ed_rate'] = df['ed_visits'] / df['member_months'] * 1000",
    },
    {
      category: "Population Health",
      name: "PMPM Cost",
      code: "df['pmpm'] = df['total_cost'] / df['member_months']",
    },
    {
      category: "Population Health",
      name: "Quality Measure Compliance",
      code: "df['qm_comp'] = df['numerator_met'] / df['denominator_eligible']",
    },
  ],
  RETAIL: [
    {
      category: "Sales Performance",
      name: "Total Revenue",
      code: "df['revenue'] = df['quantity'] * df['price']",
    },
    {
      category: "Sales Performance",
      name: "Gross Profit",
      code: "df['gp'] = df['revenue'] - df['cost']",
    },
    {
      category: "Sales Performance",
      name: "Gross Margin %",
      code: "df['gm_pct'] = df['gp'] / df['revenue']",
    },
    {
      category: "Sales Performance",
      name: "Net Sales",
      code: "df['net_sales'] = df['gross_sales'] - df['returns'] - df['discounts']",
    },
    {
      category: "Sales Performance",
      name: "Same-Store Sales Growth",
      code: "df['sssg'] = df[df['store_age_yrs']>=1].groupby('store_id')['revenue'].pct_change()",
    },
    {
      category: "Sales Performance",
      name: "Revenue per Square Foot",
      code: "df['rev_sqft'] = df['revenue'] / df['store_sqft']",
    },
    {
      category: "Sales Performance",
      name: "Sales per Employee",
      code: "df['sales_emp'] = df['revenue'] / df['fte']",
    },
    {
      category: "Sales Performance",
      name: "Sell-through Rate",
      code: "df['str'] = df['units_sold'] / df['units_received']",
    },
    {
      category: "Sales Performance",
      name: "Conversion Rate (traffic)",
      code: "df['traffic_cvr'] = df['transactions'] / df['footfall']",
    },
    {
      category: "Sales Performance",
      name: "Basket Size",
      code: "df['basket'] = df['items_per_txn'].mean()",
    },
    {
      category: "Sales Performance",
      name: "Average Transaction Value",
      code: "df['atv'] = df['revenue'] / df['transactions']",
    },
    {
      category: "Sales Performance",
      name: "Items per Basket",
      code: "df['ipb'] = df['total_items'] / df['transactions']",
    },
    {
      category: "Sales Performance",
      name: "Revenue per Visit",
      code: "df['rpv'] = df['revenue'] / df['visits']",
    },
    {
      category: "Sales Performance",
      name: "Markdown Rate",
      code: "df['md_rate'] = df['markdown_amount'] / df['original_retail']",
    },
    {
      category: "Sales Performance",
      name: "GMROI",
      code: "df['gmroi'] = df['gp'] / df['avg_inventory_cost']",
    },
    {
      category: "Sales Performance",
      name: "Return Rate",
      code: "df['return_rate'] = df['units_returned'] / df['units_sold']",
    },
    {
      category: "Sales Performance",
      name: "Return Revenue Impact",
      code: "df['ret_rev_impact'] = df['returned_revenue'] / df['gross_revenue']",
    },
    {
      category: "Sales Performance",
      name: "Refund Rate",
      code: "df['refund_rate'] = df['refund_amount'] / df['gross_revenue']",
    },
    {
      category: "Sales Performance",
      name: "YoY Revenue Growth",
      code: "df['rev_yoy'] = df.groupby(['store_id','month'])['revenue'].pct_change(12)",
    },
    {
      category: "Sales Performance",
      name: "MoM Revenue Growth",
      code: "df['rev_mom'] = df.groupby('store_id')['revenue'].pct_change()",
    },
    {
      category: "Sales Performance",
      name: "Revenue Trend (3M)",
      code: "df['rev_trend'] = df['revenue'].rolling(3).mean()",
    },
    {
      category: "Sales Performance",
      name: "Cumulative YTD Revenue",
      code: "df['ytd_rev'] = df.groupby([df['date'].dt.year,'store_id'])['revenue'].cumsum()",
    },
    {
      category: "Sales Performance",
      name: "Weekend vs Weekday Sales",
      code: "df['wknd_ratio'] = df[df['dow']>=5]['revenue'].mean() / df[df['dow']<5]['revenue'].mean()",
    },
    {
      category: "Sales Performance",
      name: "Promotion Uplift",
      code: "df['promo_uplift'] = (df[df['promo']==1]['revenue'].mean() - df[df['promo']==0]['revenue'].mean()) / df[df['promo']==0]['revenue'].mean()",
    },
    {
      category: "Inventory",
      name: "Inventory Turnover",
      code: "df['inv_turn'] = df['cogs'] / df['avg_inventory']",
    },
    {
      category: "Inventory",
      name: "Days Sales of Inventory",
      code: "df['dsi'] = df['avg_inventory'] / (df['cogs'] / 365)",
    },
    {
      category: "Inventory",
      name: "Stock Coverage (days)",
      code: "df['coverage'] = df['on_hand'] / df['avg_daily_sales']",
    },
    {
      category: "Inventory",
      name: "Stockout Rate",
      code: "df['stockout_rate'] = df['oos_days'] / df['total_days']",
    },
    {
      category: "Inventory",
      name: "Overstock Flag",
      code: "df['overstock'] = (df['coverage'] > 90).astype(int)",
    },
    {
      category: "Inventory",
      name: "Dead Stock Value",
      code: "df['dead_stock'] = df[df['days_no_sale'] > 180]['inventory_value'].sum()",
    },
    {
      category: "Inventory",
      name: "Reorder Point",
      code: "df['rop'] = df['avg_daily_sales'] * df['lead_time_days'] + df['safety_stock']",
    },
    {
      category: "Inventory",
      name: "Safety Stock",
      code: "df['safety_stock'] = df['z_score'] * df['demand_std'] * np.sqrt(df['lead_time_days'])",
    },
    {
      category: "Inventory",
      name: "EOQ",
      code: "df['eoq'] = np.sqrt(2 * df['annual_demand'] * df['order_cost'] / df['holding_cost'])",
    },
    {
      category: "Inventory",
      name: "Shrinkage Rate",
      code: "df['shrinkage'] = (df['theoretical_inv'] - df['actual_inv']) / df['theoretical_inv']",
    },
    {
      category: "Inventory",
      name: "Inventory Accuracy",
      code: "df['inv_acc'] = df['correct_locs'] / df['total_locs']",
    },
    {
      category: "Inventory",
      name: "Avg Cost per Unit",
      code: "df['avg_cost'] = df['total_cost'] / df['units_on_hand']",
    },
    {
      category: "Inventory",
      name: "Fill Rate",
      code: "df['fill_rate'] = df['units_shipped'] / df['units_ordered']",
    },
    {
      category: "Inventory",
      name: "Backorder Rate",
      code: "df['bo_rate'] = df['backordered_units'] / df['ordered_units']",
    },
    {
      category: "Inventory",
      name: "ABC Classification",
      code: "df['abc'] = pd.cut(df['revenue'].rank(pct=True), bins=[0,0.2,0.5,1], labels=['C','B','A'])",
    },
    {
      category: "Inventory",
      name: "Obsolescence Rate",
      code: "df['obs_rate'] = df['obsolete_units'] / df['total_units']",
    },
    {
      category: "Inventory",
      name: "Weeks of Supply",
      code: "df['wos'] = df['on_hand'] / (df['weekly_sales'] + 1e-9)",
    },
    {
      category: "Inventory",
      name: "Carrying Cost",
      code: "df['carry_cost'] = df['avg_inventory'] * df['holding_rate']",
    },
    {
      category: "Inventory",
      name: "Cycle Count Variance",
      code: "df['cc_var'] = (df['counted'] - df['expected']).abs() / df['expected']",
    },
    {
      category: "Merchandising",
      name: "Product Velocity",
      code: "df['velocity'] = df['units_sold'] / df['days_active']",
    },
    {
      category: "Merchandising",
      name: "Category Share of Sales",
      code: "df['cat_share'] = df.groupby('category')['revenue'].transform('sum') / df['revenue'].sum()",
    },
    {
      category: "Merchandising",
      name: "Brand Share",
      code: "df['brand_share'] = df.groupby('brand')['units'].transform('sum') / df['units'].sum()",
    },
    {
      category: "Merchandising",
      name: "SKU Count by Category",
      code: "df.groupby('category')['sku'].nunique()",
    },
    {
      category: "Merchandising",
      name: "Assortment Depth Score",
      code: "df['depth'] = df.groupby(['category','brand'])['sku'].transform('count')",
    },
    {
      category: "Merchandising",
      name: "New Product Revenue Share",
      code: "df['new_prod_share'] = df[df['product_age_days']<=90]['revenue'].sum() / df['revenue'].sum()",
    },
    {
      category: "Merchandising",
      name: "Product Life Cycle Stage",
      code: "df['plc'] = pd.cut(df['product_age_months'], bins=[0,3,12,36,9999], labels=['launch','growth','maturity','decline'])",
    },
    {
      category: "Merchandising",
      name: "Planogram Compliance Score",
      code: "df['planogram_score'] = df['compliant_facings'] / df['total_facings']",
    },
    {
      category: "Merchandising",
      name: "Shelf Share",
      code: "df['shelf_share'] = df['facings'] / df['total_facings_cat']",
    },
    {
      category: "Merchandising",
      name: "Price Index vs Market",
      code: "df['price_idx'] = df['price'] / df['market_avg_price']",
    },
    {
      category: "Merchandising",
      name: "Private Label Share",
      code: "df['pl_share'] = df[df['brand_type']=='PL']['revenue'].sum() / df['revenue'].sum()",
    },
    {
      category: "Merchandising",
      name: "Cross-category Basket Rate",
      code: "df['xcat_rate'] = df.groupby('basket_id')['category'].transform('nunique') > 1",
    },
    {
      category: "Merchandising",
      name: "Product Affinity Score",
      code: "# use market basket analysis: mlxtend.frequent_patterns.apriori",
    },
    {
      category: "Merchandising",
      name: "Cannibalization Rate",
      code: "df['cann'] = df['sales_loss_existing'] / df['new_sku_sales']",
    },
    {
      category: "Pricing",
      name: "Price Elasticity",
      code: "df['elasticity'] = df['qty'].pct_change() / df['price'].pct_change()",
    },
    {
      category: "Pricing",
      name: "Optimal Price (unit margin max)",
      code: "df['opt_price'] = df['unit_cost'] / (1 - 1/abs(df['elasticity']))",
    },
    {
      category: "Pricing",
      name: "Competitive Price Gap",
      code: "df['price_gap'] = (df['our_price'] - df['comp_price']) / df['comp_price']",
    },
    {
      category: "Pricing",
      name: "Margin Improvement Opportunity",
      code: "df['marg_opp'] = (df['opt_price'] - df['price']) * df['expected_qty']",
    },
    {
      category: "Pricing",
      name: "Price Bucket",
      code: "df['price_bucket'] = pd.cut(df['price'], bins=5, labels=['value','low','mid','high','prem'])",
    },
    {
      category: "Pricing",
      name: "Discount Depth",
      code: "df['disc_depth'] = df['discount'] / df['regular_price']",
    },
    {
      category: "Pricing",
      name: "Price Variance to List",
      code: "df['price_var'] = (df['actual_price'] - df['list_price']) / df['list_price']",
    },
    {
      category: "Pricing",
      name: "Dynamic Price Index",
      code: "df['dyn_idx'] = df['price'] / df.groupby('date')['price'].transform('mean')",
    },
    {
      category: "Pricing",
      name: "Promo Frequency",
      code: "df['promo_freq'] = df.groupby('sku')['on_promo'].transform('mean')",
    },
    {
      category: "Pricing",
      name: "Average Selling Price",
      code: "df['asp'] = df['revenue'] / df['units_sold']",
    },
    {
      category: "Customer",
      name: "Loyalty Tier",
      code: "df['tier'] = pd.cut(df['ytd_spend'], bins=[0,100,500,2000,999999], labels=['bronze','silver','gold','platinum'])",
    },
    {
      category: "Customer",
      name: "Repeat Purchase Rate",
      code: "df['repeat_rate'] = (df['purchase_count'] > 1).mean()",
    },
    {
      category: "Customer",
      name: "Avg Days Between Purchases",
      code: "df['ipt'] = df.groupby('customer_id')['order_date'].diff().dt.days.mean()",
    },
    {
      category: "Customer",
      name: "Category Shopper Flag",
      code: "df['cat_shopper'] = df.groupby('customer_id')['category'].transform(lambda x: x.mode()[0])",
    },
    {
      category: "Customer",
      name: "Single-channel vs Multi-channel",
      code: "df['multichannel'] = (df.groupby('customer_id')['channel'].transform('nunique') > 1).astype(int)",
    },
    {
      category: "Customer",
      name: "Loyalty Points Balance",
      code: "df['pts_earned'] = df['spend'] * df['earn_rate']",
    },
    {
      category: "Customer",
      name: "Redemption Rate (points)",
      code: "df['redemption_rate'] = df['pts_redeemed'] / df['pts_earned']",
    },
    {
      category: "Customer",
      name: "Customer Age (since first purchase)",
      code: "df['cust_age_days'] = (df['today'] - df['first_purchase']).dt.days",
    },
    {
      category: "Customer",
      name: "Top Category Spend Share",
      code: "df['top_cat_share'] = df.groupby(['customer_id','category'])['spend'].transform('sum') / df.groupby('customer_id')['spend'].transform('sum')",
    },
    {
      category: "Customer",
      name: "Exclusive Category Shopper",
      code: "df['excl'] = (df.groupby('customer_id')['category'].transform('nunique') == 1).astype(int)",
    },
    {
      category: "Store Operations",
      name: "Footfall Count",
      code: "df['footfall_idx'] = df['footfall'] / df['footfall'].mean()",
    },
    {
      category: "Store Operations",
      name: "Dwell Time by Zone",
      code: "df.groupby('zone')['dwell_minutes'].mean()",
    },
    {
      category: "Store Operations",
      name: "Queue Wait Time",
      code: "df['queue_wait'] = (df['served_time'] - df['join_time']).dt.total_seconds() / 60",
    },
    {
      category: "Store Operations",
      name: "Staff Scheduling Ratio",
      code: "df['staff_ratio'] = df['customers_per_hour'] / df['staff_on_floor']",
    },
    {
      category: "Store Operations",
      name: "Checkout Throughput",
      code: "df['checkout_tp'] = df['transactions'] / df['checkout_hours']",
    },
    {
      category: "Store Operations",
      name: "Store Labor %",
      code: "df['labor_pct'] = df['labor_cost'] / df['revenue']",
    },
    {
      category: "Store Operations",
      name: "Shrink %",
      code: "df['shrink_pct'] = df['shrinkage_value'] / df['gross_sales']",
    },
    {
      category: "Store Operations",
      name: "Ops Score",
      code: "df['ops_score'] = df[['inv_acc','fill_rate','footfall_idx']].mean(axis=1)",
    },
    {
      category: "Forecasting",
      name: "7-day Rolling Sales Avg",
      code: "df['roll7'] = df['units'].rolling(7).mean()",
    },
    {
      category: "Forecasting",
      name: "28-day Rolling Sales Avg",
      code: "df['roll28'] = df['units'].rolling(28).mean()",
    },
    {
      category: "Forecasting",
      name: "Seasonal Decompose Trend",
      code: "from statsmodels.tsa.seasonal import seasonal_decompose; result=seasonal_decompose(df['units'],model='additive',period=7)",
    },
    {
      category: "Forecasting",
      name: "Forecast Bias",
      code: "df['bias'] = (df['forecast'] - df['actual']).mean()",
    },
    {
      category: "Forecasting",
      name: "MAPE",
      code: "df['mape'] = (abs(df['forecast']-df['actual'])/df['actual']).mean()*100",
    },
    {
      category: "Forecasting",
      name: "WAPE",
      code: "df['wape'] = abs(df['forecast']-df['actual']).sum()/df['actual'].sum()*100",
    },
    {
      category: "Forecasting",
      name: "Forecast Accuracy",
      code: "df['fa'] = 1 - df['wape']/100",
    },
    {
      category: "Forecasting",
      name: "Demand Variability (CV)",
      code: "df['cv'] = df.groupby('sku')['units'].transform('std') / df.groupby('sku')['units'].transform('mean')",
    },
    {
      category: "Forecasting",
      name: "Seasonality Index",
      code: "df['seas'] = df.groupby('week_of_year')['units'].transform('mean') / df['units'].mean()",
    },
    {
      category: "Forecasting",
      name: "Trend Component",
      code: "df['trend'] = df['units'].rolling(52).mean()",
    },
    {
      category: "Forecasting",
      name: "Promo Flag Lag",
      code: "df['promo_lag1'] = df['on_promo'].shift(1)",
    },
    {
      category: "Forecasting",
      name: "Holiday Sales Lift",
      code: "df['holiday_lift'] = df[df['holiday']==1]['units'].mean() / df[df['holiday']==0]['units'].mean()",
    },
  ],
  MANUFACTURING: [
    {
      category: "OEE",
      name: "Availability Rate",
      code: "df['availability'] = df['run_time'] / df['planned_time']",
    },
    {
      category: "OEE",
      name: "Performance Rate",
      code: "df['performance'] = (df['ideal_cycle_time'] * df['total_count']) / df['run_time']",
    },
    {
      category: "OEE",
      name: "Quality Rate",
      code: "df['quality'] = df['good_count'] / df['total_count']",
    },
    {
      category: "OEE",
      name: "OEE",
      code: "df['oee'] = df['availability'] * df['performance'] * df['quality']",
    },
    {
      category: "OEE",
      name: "TEEP",
      code: "df['teep'] = df['oee'] * (df['planned_time'] / df['total_time'])",
    },
    {
      category: "OEE",
      name: "Unplanned Downtime %",
      code: "df['unplanned_dt_pct'] = df['unplanned_downtime'] / df['planned_time']",
    },
    {
      category: "OEE",
      name: "Planned Downtime %",
      code: "df['planned_dt_pct'] = df['planned_downtime'] / df['total_time']",
    },
    {
      category: "OEE",
      name: "Mean Time Between Failures",
      code: "df['mtbf'] = df['run_time'] / df['failure_count']",
    },
    {
      category: "OEE",
      name: "Mean Time to Repair",
      code: "df['mttr'] = df['total_repair_time'] / df['failure_count']",
    },
    {
      category: "OEE",
      name: "Failure Rate",
      code: "df['fail_rate'] = df['failure_count'] / df['run_time']",
    },
    {
      category: "OEE",
      name: "Machine Utilization",
      code: "df['util'] = df['actual_run'] / df['available_time']",
    },
    {
      category: "OEE",
      name: "Cycle Time Efficiency",
      code: "df['ct_eff'] = df['ideal_cycle_time'] / df['actual_cycle_time']",
    },
    {
      category: "OEE",
      name: "Speed Loss",
      code: "df['speed_loss'] = (1 - df['performance']) * df['run_time']",
    },
    {
      category: "OEE",
      name: "Downtime Pareto",
      code: "df.groupby('failure_reason')['downtime_mins'].sum().sort_values(ascending=False)",
    },
    {
      category: "OEE",
      name: "OEE Trend 30d",
      code: "df['oee_trend'] = df['oee'].rolling(30).mean()",
    },
    {
      category: "Quality",
      name: "Defect Rate (PPM)",
      code: "df['ppm'] = (df['defects'] / df['total_units']) * 1_000_000",
    },
    {
      category: "Quality",
      name: "First Pass Yield",
      code: "df['fpy'] = df['units_passed_first'] / df['units_started']",
    },
    {
      category: "Quality",
      name: "Rolled Throughput Yield",
      code: "df['rty'] = df[['fpy_op1','fpy_op2','fpy_op3']].prod(axis=1)",
    },
    {
      category: "Quality",
      name: "Scrap Rate",
      code: "df['scrap_rate'] = df['scrapped_units'] / df['total_units']",
    },
    {
      category: "Quality",
      name: "Rework Rate",
      code: "df['rework_rate'] = df['rework_units'] / df['total_units']",
    },
    {
      category: "Quality",
      name: "DPMO",
      code: "df['dpmo'] = (df['defects'] / (df['units'] * df['opportunities_per_unit'])) * 1_000_000",
    },
    {
      category: "Quality",
      name: "Sigma Level",
      code: "from scipy.stats import norm; df['sigma']=norm.ppf(1-df['dpmo']/1e6)+1.5",
    },
    {
      category: "Quality",
      name: "Cpk",
      code: "df['cpk'] = np.minimum((df['usl']-df['process_mean'])/(3*df['process_std']), (df['process_mean']-df['lsl'])/(3*df['process_std']))",
    },
    {
      category: "Quality",
      name: "Cp",
      code: "df['cp'] = (df['usl'] - df['lsl']) / (6 * df['process_std'])",
    },
    {
      category: "Quality",
      name: "Control Chart UCL",
      code: "df['ucl'] = df['xbar'] + 3 * df['sigma_xbar']",
    },
    {
      category: "Quality",
      name: "Control Chart LCL",
      code: "df['lcl'] = df['xbar'] - 3 * df['sigma_xbar']",
    },
    {
      category: "Quality",
      name: "Out-of-Control Flag",
      code: "df['ooc'] = ((df['value'] > df['ucl']) | (df['value'] < df['lcl'])).astype(int)",
    },
    {
      category: "Quality",
      name: "Customer Complaints Rate",
      code: "df['complaint_rate'] = df['complaints'] / df['units_shipped'] * 1e6",
    },
    {
      category: "Quality",
      name: "Warranty Claim Rate",
      code: "df['warranty_rate'] = df['warranty_claims'] / df['units_sold']",
    },
    {
      category: "Quality",
      name: "Cost of Poor Quality",
      code: "df['copq'] = df['scrap_cost'] + df['rework_cost'] + df['warranty_cost']",
    },
    {
      category: "Quality",
      name: "Right First Time %",
      code: "df['rft'] = df['accepted_first'] / df['total_produced']",
    },
    {
      category: "Quality",
      name: "Inspection Pass Rate",
      code: "df['insp_pass'] = df['passed'] / df['inspected']",
    },
    {
      category: "Quality",
      name: "Field Failure Rate",
      code: "df['ffr'] = df['field_failures'] / df['units_in_field']",
    },
    {
      category: "Quality",
      name: "Non-Conformance Rate",
      code: "df['nc_rate'] = df['nc_items'] / df['total_items']",
    },
    {
      category: "Quality",
      name: "Escapes to Customer",
      code: "df['escapes'] = df['customer_defects'] / df['shipments']",
    },
    {
      category: "Production",
      name: "Throughput Rate",
      code: "df['throughput'] = df['units_produced'] / df['hours_worked']",
    },
    {
      category: "Production",
      name: "Takt Time",
      code: "df['takt'] = df['available_time'] / df['customer_demand']",
    },
    {
      category: "Production",
      name: "Cycle Time",
      code: "df['ct'] = df['total_process_time'] / df['units_produced']",
    },
    {
      category: "Production",
      name: "Lead Time",
      code: "df['lead_time'] = (df['delivery_date'] - df['order_date']).dt.days",
    },
    {
      category: "Production",
      name: "Production Efficiency",
      code: "df['prod_eff'] = df['actual_output'] / df['standard_output']",
    },
    {
      category: "Production",
      name: "Capacity Utilization",
      code: "df['cap_util'] = df['actual_output'] / df['max_capacity']",
    },
    {
      category: "Production",
      name: "On-Time Delivery Rate",
      code: "df['otd'] = (df['delivery_date'] <= df['promised_date']).mean()",
    },
    {
      category: "Production",
      name: "Schedule Adherence",
      code: "df['sched_adh'] = df['scheduled_completed'] / df['scheduled_total']",
    },
    {
      category: "Production",
      name: "Changeover Time",
      code: "df['changeover'] = (df['production_start'] - df['last_production_end']).dt.total_seconds() / 60",
    },
    {
      category: "Production",
      name: "Setup Ratio",
      code: "df['setup_ratio'] = df['setup_time'] / (df['setup_time'] + df['run_time'])",
    },
    {
      category: "Production",
      name: "Work-in-Progress Value",
      code: "df['wip_val'] = df['wip_units'] * df['unit_cost']",
    },
    {
      category: "Production",
      name: "WIP Turns",
      code: "df['wip_turns'] = df['cogs'] / df['avg_wip']",
    },
    {
      category: "Production",
      name: "Line Balancing Efficiency",
      code: "df['lbe'] = df['total_task_time'] / (df['stations'] * df['cycle_time'])",
    },
    {
      category: "Production",
      name: "Labor Efficiency",
      code: "df['labor_eff'] = df['standard_hours'] / df['actual_hours']",
    },
    {
      category: "Production",
      name: "Machine Hours per Unit",
      code: "df['mh_unit'] = df['machine_hours'] / df['units_produced']",
    },
    {
      category: "Production",
      name: "Output per Shift",
      code: "df['ops'] = df.groupby('shift')['units'].mean()",
    },
    {
      category: "Production",
      name: "Batch Size Variance",
      code: "df['batch_var'] = (df['actual_batch'] - df['planned_batch']) / df['planned_batch']",
    },
    {
      category: "Production",
      name: "Standard vs Actual Cost",
      code: "df['cost_var'] = df['actual_cost'] - df['standard_cost']",
    },
    {
      category: "Production",
      name: "Overhead Absorption Rate",
      code: "df['overhead_abs'] = df['overhead_applied'] / df['actual_overhead']",
    },
    {
      category: "Production",
      name: "Production Volume Index",
      code: "df['pvi'] = df['units'] / df['units'].rolling(12).mean()",
    },
    {
      category: "Maintenance",
      name: "PM Compliance Rate",
      code: "df['pm_comp'] = df['pm_completed'] / df['pm_scheduled']",
    },
    {
      category: "Maintenance",
      name: "Reactive vs Planned Ratio",
      code: "df['reactive_ratio'] = df['reactive_hrs'] / df['total_maint_hrs']",
    },
    {
      category: "Maintenance",
      name: "Equipment Criticality Score",
      code: "df['criticality'] = df['failure_impact'] * df['failure_probability']",
    },
    {
      category: "Maintenance",
      name: "Condition-Based Score",
      code: "df['cond_score'] = df[['vibration_z','temperature_z','current_z']].mean(axis=1)",
    },
    {
      category: "Maintenance",
      name: "Remaining Useful Life (linear)",
      code: "df['rul'] = (df['threshold'] - df['degradation_value']) / df['degradation_rate']",
    },
    {
      category: "Maintenance",
      name: "Vibration Z-score",
      code: "df['vib_z'] = (df['vibration'] - df['vibration'].mean()) / df['vibration'].std()",
    },
    {
      category: "Maintenance",
      name: "Temperature Anomaly",
      code: "df['temp_anom'] = (df['temperature'] > df['temperature'].mean() + 3*df['temperature'].std()).astype(int)",
    },
    {
      category: "Maintenance",
      name: "Oil Analysis Trend",
      code: "df['oil_trend'] = df['particle_count'].rolling(5).mean()",
    },
    {
      category: "Maintenance",
      name: "Maintenance Cost per Unit",
      code: "df['mc_unit'] = df['maint_cost'] / df['units_produced']",
    },
    {
      category: "Maintenance",
      name: "Spare Parts Availability",
      code: "df['parts_avail'] = df['in_stock_parts'] / df['required_parts']",
    },
    {
      category: "Maintenance",
      name: "Downtime Cost",
      code: "df['dt_cost'] = df['downtime_hrs'] * df['hourly_production_value']",
    },
    {
      category: "Maintenance",
      name: "Failure Mode Count",
      code: "df.groupby('failure_mode')['incident_id'].count()",
    },
    {
      category: "Maintenance",
      name: "Work Order Backlog",
      code: "df['wo_backlog'] = df['open_wo'] / df['weekly_capacity']",
    },
    {
      category: "Energy",
      name: "Energy Intensity",
      code: "df['energy_intensity'] = df['kwh'] / df['units_produced']",
    },
    {
      category: "Energy",
      name: "Energy Cost per Unit",
      code: "df['e_cost_unit'] = df['energy_cost'] / df['units_produced']",
    },
    {
      category: "Energy",
      name: "Power Factor",
      code: "df['pf'] = df['kw'] / df['kva']",
    },
    {
      category: "Energy",
      name: "Specific Energy Consumption",
      code: "df['sec'] = df['kwh'] / df['production_tonnage']",
    },
    {
      category: "Energy",
      name: "Peak Demand Ratio",
      code: "df['peak_ratio'] = df['peak_demand_kw'] / df['avg_demand_kw']",
    },
    {
      category: "Energy",
      name: "GHG Emissions (Scope 1)",
      code: "df['co2e'] = df['fuel_consumed'] * df['emission_factor']",
    },
    {
      category: "Energy",
      name: "Energy Savings vs Baseline",
      code: "df['e_savings'] = df['baseline_kwh'] - df['actual_kwh']",
    },
    {
      category: "Energy",
      name: "Carbon Intensity",
      code: "df['ci'] = df['co2e'] / df['revenue']",
    },
    {
      category: "Energy",
      name: "Load Factor",
      code: "df['load_factor'] = df['avg_demand'] / df['peak_demand']",
    },
    {
      category: "Supply Chain",
      name: "Supplier On-Time Rate",
      code: "df['sup_otd'] = (df['actual_receipt'] <= df['promised_receipt']).mean()",
    },
    {
      category: "Supply Chain",
      name: "Supplier Quality Rate",
      code: "df['sup_qual'] = df['accepted_qty'] / df['received_qty']",
    },
    {
      category: "Supply Chain",
      name: "Purchase Price Variance",
      code: "df['ppv'] = (df['actual_price'] - df['standard_price']) * df['qty']",
    },
    {
      category: "Supply Chain",
      name: "Raw Material Inventory DSI",
      code: "df['rm_dsi'] = df['rm_inventory'] / (df['rm_consumed'] / 365)",
    },
    {
      category: "Supply Chain",
      name: "BOM Accuracy",
      code: "df['bom_acc'] = df['correct_items'] / df['total_bom_items']",
    },
    {
      category: "Supply Chain",
      name: "Component Availability",
      code: "df['comp_avail'] = df['available_components'] / df['required_components']",
    },
    {
      category: "Supply Chain",
      name: "Make vs Buy Decision Score",
      code: "df['mvb'] = df['internal_cost'] / df['external_cost']",
    },
    {
      category: "Supply Chain",
      name: "Supplier Concentration",
      code: "df['sup_conc'] = df.groupby('supplier')['spend'].transform('sum') / df['spend'].sum()",
    },
    {
      category: "Supply Chain",
      name: "Single Source Risk Flag",
      code: "df['single_src'] = (df.groupby('component')['supplier'].transform('nunique') == 1).astype(int)",
    },
    {
      category: "Supply Chain",
      name: "Procurement Cycle Time",
      code: "df['proc_ct'] = (df['receipt_date'] - df['po_date']).dt.days",
    },
    {
      category: "Safety",
      name: "TRIR",
      code: "df['trir'] = (df['recordable_incidents'] * 200_000) / df['hours_worked']",
    },
    {
      category: "Safety",
      name: "LTIR (Lost Time)",
      code: "df['ltir'] = (df['lost_time_incidents'] * 200_000) / df['hours_worked']",
    },
    {
      category: "Safety",
      name: "Near Miss Rate",
      code: "df['near_miss_rate'] = df['near_misses'] / df['hours_worked'] * 200_000",
    },
    {
      category: "Safety",
      name: "Days Since Last Incident",
      code: "df['days_since_incident'] = (df['today'] - df['last_incident_date']).dt.days",
    },
    {
      category: "Safety",
      name: "Safety Observation Rate",
      code: "df['obs_rate'] = df['safety_observations'] / df['employees']",
    },
    {
      category: "Safety",
      name: "PPE Compliance Rate",
      code: "df['ppe_comp'] = df['compliant_observations'] / df['total_observations']",
    },
    {
      category: "Safety",
      name: "Unsafe Act Ratio",
      code: "df['unsafe_ratio'] = df['unsafe_acts'] / df['total_observations']",
    },
    {
      category: "Safety",
      name: "Severity Rate",
      code: "df['severity_rate'] = (df['lost_days'] * 200_000) / df['hours_worked']",
    },
    {
      category: "Safety",
      name: "Hazard Closure Rate",
      code: "df['haz_closure'] = df['closed_hazards'] / df['reported_hazards']",
    },
    {
      category: "Safety",
      name: "Safety Training Compliance",
      code: "df['train_comp'] = df['trained_employees'] / df['total_employees']",
    },
  ],
  ECOMMERCE: [
    {
      category: "Website Performance",
      name: "Page Load Time Bucket",
      code: "df['load_bucket'] = pd.cut(df['load_time_s'], bins=[0,1,2,3,5,99], labels=['<1s','1-2s','2-3s','3-5s','>5s'])",
    },
    {
      category: "Website Performance",
      name: "Bounce Rate",
      code: "df['bounce_rate'] = df['single_page_sessions'] / df['sessions']",
    },
    {
      category: "Website Performance",
      name: "Conversion Rate",
      code: "df['cvr'] = df['orders'] / df['sessions']",
    },
    {
      category: "Website Performance",
      name: "Add-to-Cart Rate",
      code: "df['atc_rate'] = df['add_to_cart'] / df['product_views']",
    },
    {
      category: "Website Performance",
      name: "Cart Abandonment Rate",
      code: "df['cart_abandon'] = 1 - df['orders'] / df['carts_created']",
    },
    {
      category: "Website Performance",
      name: "Checkout Abandonment",
      code: "df['checkout_abandon'] = 1 - df['orders'] / df['checkout_starts']",
    },
    {
      category: "Website Performance",
      name: "Product Page CTR",
      code: "df['pdp_ctr'] = df['product_clicks'] / df['impressions']",
    },
    {
      category: "Website Performance",
      name: "Search Conversion Rate",
      code: "df['search_cvr'] = df['search_conversions'] / df['search_sessions']",
    },
    {
      category: "Website Performance",
      name: "Zero Results Rate",
      code: "df['zero_results'] = df['searches_no_results'] / df['total_searches']",
    },
    {
      category: "Website Performance",
      name: "Mobile vs Desktop Split",
      code: "df['mobile_share'] = (df['device']=='mobile').mean()",
    },
    {
      category: "Website Performance",
      name: "New vs Returning Sessions",
      code: "df['new_session_rate'] = df['new_sessions'] / df['total_sessions']",
    },
    {
      category: "Website Performance",
      name: "Average Session Duration",
      code: "df['avg_dur'] = df['total_duration_s'] / df['sessions']",
    },
    {
      category: "Website Performance",
      name: "Pages per Session",
      code: "df['pps'] = df['pageviews'] / df['sessions']",
    },
    {
      category: "Website Performance",
      name: "Core Web Vitals LCP",
      code: "df['good_lcp'] = (df['lcp_ms'] < 2500).astype(int)",
    },
    {
      category: "Website Performance",
      name: "Core Web Vitals CLS",
      code: "df['good_cls'] = (df['cls_score'] < 0.1).astype(int)",
    },
    {
      category: "Website Performance",
      name: "Site Error Rate (5xx)",
      code: "df['error_rate'] = df['5xx_errors'] / df['requests']",
    },
    {
      category: "Website Performance",
      name: "API Response Time P95",
      code: "df['p95_resp'] = df['api_response_ms'].quantile(0.95)",
    },
    {
      category: "Funnel Metrics",
      name: "Visit to PDP Rate",
      code: "df['v2pdp'] = df['pdp_views'] / df['sessions']",
    },
    {
      category: "Funnel Metrics",
      name: "PDP to ATC Rate",
      code: "df['pdp2atc'] = df['atc_events'] / df['pdp_views']",
    },
    {
      category: "Funnel Metrics",
      name: "ATC to Checkout Rate",
      code: "df['atc2co'] = df['checkout_starts'] / df['atc_events']",
    },
    {
      category: "Funnel Metrics",
      name: "Checkout to Purchase Rate",
      code: "df['co2pur'] = df['orders'] / df['checkout_starts']",
    },
    {
      category: "Funnel Metrics",
      name: "Full Funnel CVR",
      code: "df['full_cvr'] = df['orders'] / df['sessions']",
    },
    {
      category: "Funnel Metrics",
      name: "Email Capture Rate",
      code: "df['email_cap'] = df['emails_captured'] / df['visitors']",
    },
    {
      category: "Funnel Metrics",
      name: "Wishlist Add Rate",
      code: "df['wish_rate'] = df['wishlist_adds'] / df['pdp_views']",
    },
    {
      category: "Funnel Metrics",
      name: "Review Read Rate",
      code: "df['review_read'] = df['review_views'] / df['pdp_views']",
    },
    {
      category: "Funnel Metrics",
      name: "Cross-sell Click Rate",
      code: "df['xsell_ctr'] = df['xsell_clicks'] / df['xsell_impressions']",
    },
    {
      category: "Funnel Metrics",
      name: "Upsell Acceptance Rate",
      code: "df['upsell_acc'] = df['upsell_orders'] / df['eligible_orders']",
    },
    {
      category: "Order & Revenue",
      name: "GMV",
      code: "df['gmv'] = df['quantity'] * df['list_price']",
    },
    {
      category: "Order & Revenue",
      name: "Net Revenue",
      code: "df['net_rev'] = df['gmv'] - df['discounts'] - df['returns']",
    },
    {
      category: "Order & Revenue",
      name: "Take Rate",
      code: "df['take_rate'] = df['net_revenue'] / df['gmv']",
    },
    {
      category: "Order & Revenue",
      name: "Average Order Value",
      code: "df['aov'] = df['revenue'] / df['orders']",
    },
    {
      category: "Order & Revenue",
      name: "Units per Order",
      code: "df['upo'] = df['units'] / df['orders']",
    },
    {
      category: "Order & Revenue",
      name: "Revenue per Session",
      code: "df['rps'] = df['revenue'] / df['sessions']",
    },
    {
      category: "Order & Revenue",
      name: "Revenue per Visitor",
      code: "df['rpv'] = df['revenue'] / df['visitors']",
    },
    {
      category: "Order & Revenue",
      name: "Discount Rate",
      code: "df['disc_rate'] = df['discount_amount'] / df['gmv']",
    },
    {
      category: "Order & Revenue",
      name: "Return Rate",
      code: "df['ret_rate'] = df['returned_units'] / df['sold_units']",
    },
    {
      category: "Order & Revenue",
      name: "Net Margin",
      code: "df['net_margin'] = df['net_profit'] / df['net_revenue']",
    },
    {
      category: "Order & Revenue",
      name: "Shipping Cost per Order",
      code: "df['ship_cost'] = df['total_shipping'] / df['orders']",
    },
    {
      category: "Order & Revenue",
      name: "Shipping Revenue per Order",
      code: "df['ship_rev'] = df['shipping_revenue'] / df['orders']",
    },
    {
      category: "Order & Revenue",
      name: "Free Shipping Threshold Adherence",
      code: "df['above_thresh'] = (df['order_value'] >= df['free_ship_threshold']).mean()",
    },
    {
      category: "Order & Revenue",
      name: "Payment Method Mix",
      code: "df.groupby('payment_method')['orders'].sum() / df['orders'].sum()",
    },
    {
      category: "Order & Revenue",
      name: "Failed Payment Rate",
      code: "df['pay_fail_rate'] = df['failed_payments'] / df['payment_attempts']",
    },
    {
      category: "Order & Revenue",
      name: "Fraud Rate",
      code: "df['fraud_rate'] = df['fraudulent_orders'] / df['total_orders']",
    },
    {
      category: "Order & Revenue",
      name: "Chargeback Rate",
      code: "df['cb_rate'] = df['chargebacks'] / df['transactions']",
    },
    {
      category: "Catalogue / Search",
      name: "Catalogue Coverage Rate",
      code: "df['cat_cov'] = df['products_sold'] / df['products_listed']",
    },
    {
      category: "Catalogue / Search",
      name: "Image Quality Score",
      code: "df['img_score'] = df['images_with_all_angles'] / df['total_skus']",
    },
    {
      category: "Catalogue / Search",
      name: "Description Completeness",
      code: "df['desc_comp'] = df['desc_chars'] / df['desc_chars'].max()",
    },
    {
      category: "Catalogue / Search",
      name: "Search Click Rank",
      code: "df.groupby('keyword')['result_position'].mean()",
    },
    {
      category: "Catalogue / Search",
      name: "Sponsored vs Organic Click Share",
      code: "df['sponsored_share'] = df['sponsored_clicks'] / df['total_clicks']",
    },
    {
      category: "Catalogue / Search",
      name: "Query Reformulation Rate",
      code: "df['reform_rate'] = df['reformulated_queries'] / df['total_queries']",
    },
    {
      category: "Catalogue / Search",
      name: "Autocomplete Usage Rate",
      code: "df['autocomplete_rate'] = df['autocomplete_clicks'] / df['search_sessions']",
    },
    {
      category: "Catalogue / Search",
      name: "Review Coverage Rate",
      code: "df['review_cov'] = df['products_with_reviews'] / df['active_products']",
    },
    {
      category: "Catalogue / Search",
      name: "Avg Star Rating",
      code: "df['avg_stars'] = df['total_stars'] / df['review_count']",
    },
    {
      category: "Catalogue / Search",
      name: "High Rating Share (4+)",
      code: "df['high_rating'] = (df['rating'] >= 4).mean()",
    },
    {
      category: "Customer & LTV",
      name: "Customer Acquisition Cost",
      code: "df['cac'] = df['marketing_spend'] / df['new_customers']",
    },
    {
      category: "Customer & LTV",
      name: "LTV Simple",
      code: "df['ltv'] = df['aov'] * df['purchase_freq'] * df['avg_tenure_years']",
    },
    {
      category: "Customer & LTV",
      name: "LTV:CAC Ratio",
      code: "df['ltv_cac'] = df['ltv'] / df['cac']",
    },
    {
      category: "Customer & LTV",
      name: "Repeat Purchase Rate",
      code: "df['repeat_rate'] = (df['order_count'] > 1).mean()",
    },
    {
      category: "Customer & LTV",
      name: "First Purchase AOV",
      code: "df[df['order_number']==1]['order_value'].mean()",
    },
    {
      category: "Customer & LTV",
      name: "Days to Second Purchase",
      code: "df[df['order_number']==2]['days_since_first'].mean()",
    },
    {
      category: "Customer & LTV",
      name: "Customer Reactivation Rate",
      code: "df['react_rate'] = df['reactivated'] / df['lapsed']",
    },
    {
      category: "Customer & LTV",
      name: "Subscription Conversion Rate",
      code: "df['sub_cvr'] = df['subscribers'] / df['eligible_customers']",
    },
    {
      category: "Customer & LTV",
      name: "Subscriber ARPU",
      code: "df['sub_arpu'] = df['subscription_revenue'] / df['subscribers']",
    },
    {
      category: "Customer & LTV",
      name: "Free Trial Conversion Rate",
      code: "df['trial_cvr'] = df['trial_converted'] / df['trial_started']",
    },
    {
      category: "Delivery / Fulfillment",
      name: "On-Time Delivery Rate",
      code: "df['otd'] = (df['actual_delivery'] <= df['promised_delivery']).mean()",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Same-Day Fulfillment Rate",
      code: "df['sdf'] = (df['ship_date'] == df['order_date']).mean()",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Order Processing Time (hrs)",
      code: "df['proc_time'] = (df['ship_date'] - df['order_date']).dt.total_seconds() / 3600",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Transit Time (days)",
      code: "df['transit'] = (df['delivery_date'] - df['ship_date']).dt.days",
    },
    {
      category: "Delivery / Fulfillment",
      name: "WISMO Rate",
      code: "df['wismo'] = df['where_is_my_order_contacts'] / df['orders']",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Delivery Attempt Rate",
      code: "df['attempt_rate'] = df['delivery_attempts'] / df['shipments']",
    },
    {
      category: "Delivery / Fulfillment",
      name: "First Attempt Success Rate",
      code: "df['first_attempt'] = (df['attempts']==1).mean()",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Perfect Order Rate",
      code: "df['perfect_order'] = (df['on_time']&df['complete']&df['undamaged']&df['correct']).mean()",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Carrier Performance Index",
      code: "df.groupby('carrier')[['otd','damage_rate']].mean()",
    },
    {
      category: "Delivery / Fulfillment",
      name: "Undeliverable Rate",
      code: "df['undeliverable'] = df['failed_deliveries'] / df['shipments']",
    },
    {
      category: "Marketplace / Seller",
      name: "Seller GMV Share",
      code: "df.groupby('seller_id')['gmv'].sum() / df['gmv'].sum()",
    },
    {
      category: "Marketplace / Seller",
      name: "Seller Quality Score",
      code: "df['seller_qual'] = df[['rating','on_time_rate','return_rate_inv']].mean(axis=1)",
    },
    {
      category: "Marketplace / Seller",
      name: "New Seller Activation Rate",
      code: "df['new_seller_act'] = df[df['seller_age_days']<=30]['gmv'].gt(0).mean()",
    },
    {
      category: "Marketplace / Seller",
      name: "Commission Revenue",
      code: "df['commission'] = df['gmv'] * df['commission_rate']",
    },
    {
      category: "Marketplace / Seller",
      name: "Take Rate by Category",
      code: "df.groupby('category').apply(lambda x: x['commission'].sum()/x['gmv'].sum())",
    },
    {
      category: "Marketplace / Seller",
      name: "Seller Defect Rate",
      code: "df['defect_rate'] = df['seller_defects'] / df['seller_orders']",
    },
    {
      category: "Marketplace / Seller",
      name: "SKU Listing Quality Score",
      code: "df['listing_score'] = (df['has_image']*0.3 + df['has_description']*0.3 + df['has_attributes']*0.4)",
    },
    {
      category: "Marketplace / Seller",
      name: "Inventory Coverage Days",
      code: "df['inv_cov'] = df['inventory'] / df['avg_daily_orders']",
    },
    {
      category: "Marketplace / Seller",
      name: "Seller Response Rate",
      code: "df['resp_rate'] = df['messages_replied'] / df['messages_received']",
    },
    {
      category: "Marketplace / Seller",
      name: "Seller Response Time",
      code: "df['resp_time_hrs'] = df['response_time_s'] / 3600",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Recommendation CTR",
      code: "df['rec_ctr'] = df['rec_clicks'] / df['rec_impressions']",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Recommendation Conversion Rate",
      code: "df['rec_cvr'] = df['rec_orders'] / df['rec_clicks']",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Rec Revenue Share",
      code: "df['rec_rev_share'] = df['rec_revenue'] / df['total_revenue']",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Personalisation Lift",
      code: "df['pers_lift'] = df['personalised_cvr'] / df['generic_cvr'] - 1",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Collaborative Filter Score",
      code: "# sklearn: NearestNeighbors on user-item matrix",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Content-Based Score",
      code: "# cosine similarity on TF-IDF product descriptions",
    },
    {
      category: "Recommendation / Personalisation",
      name: "User Affinity Score",
      code: "df['affinity'] = df.groupby(['user_id','category'])['views'].transform('sum') / df.groupby('user_id')['views'].transform('sum')",
    },
    {
      category: "Recommendation / Personalisation",
      name: "A/B Test CVR Lift",
      code: "df['lift'] = (df[df['variant']=='B']['cvr'].mean() - df[df['variant']=='A']['cvr'].mean()) / df[df['variant']=='A']['cvr'].mean()",
    },
    {
      category: "Recommendation / Personalisation",
      name: "Category Affinity Entropy",
      code: "from scipy.stats import entropy; df.groupby('user_id')['category'].apply(lambda x: entropy(x.value_counts(normalize=True)))",
    },
    {
      category: "Recommendation / Personalisation",
      name: "New vs Known Product CTR",
      code: "df.groupby('product_novelty')['ctr'].mean()",
    },
    {
      category: "Pricing / Promotions",
      name: "Dynamic Price Change",
      code: "df['price_chg'] = df['price'].pct_change()",
    },
    {
      category: "Pricing / Promotions",
      name: "Price Competitiveness Index",
      code: "df['pci'] = df['our_price'] / df['lowest_comp_price']",
    },
    {
      category: "Pricing / Promotions",
      name: "Flash Sale Lift",
      code: "df['flash_lift'] = df[df['flash_sale']==1]['orders'].mean() / df[df['flash_sale']==0]['orders'].mean()",
    },
    {
      category: "Pricing / Promotions",
      name: "Coupon Revenue Share",
      code: "df['coupon_rev_share'] = df[df['coupon_used']==1]['revenue'].sum() / df['revenue'].sum()",
    },
    {
      category: "Pricing / Promotions",
      name: "Bundle Attach Rate",
      code: "df['bundle_attach'] = df['bundle_orders'] / df['parent_sku_orders']",
    },
    {
      category: "Pricing / Promotions",
      name: "Price Anchor Ratio",
      code: "df['anchor_ratio'] = df['original_price'] / df['sale_price']",
    },
    {
      category: "Pricing / Promotions",
      name: "Free Gift Uptake Rate",
      code: "df['gift_rate'] = df['gift_claimed'] / df['eligible_orders']",
    },
    {
      category: "Pricing / Promotions",
      name: "Promotion ROI",
      code: "df['promo_roi'] = (df['promo_revenue'] - df['promo_cost']) / df['promo_cost']",
    },
    {
      category: "Pricing / Promotions",
      name: "Incremental Revenue (promo)",
      code: "df['incr_rev'] = df['promo_revenue'] - df['baseline_revenue']",
    },
    {
      category: "Pricing / Promotions",
      name: "BOGO Redemption Rate",
      code: "df['bogo_rate'] = df['bogo_used'] / df['bogo_eligible']",
    },
    {
      category: "Time / Seasonality",
      name: "Hour of Day Feature",
      code: "df['hour'] = pd.to_datetime(df['timestamp']).dt.hour",
    },
    {
      category: "Time / Seasonality",
      name: "Day of Week",
      code: "df['dow'] = pd.to_datetime(df['date']).dt.dayofweek",
    },
    {
      category: "Time / Seasonality",
      name: "Week Number",
      code: "df['week'] = pd.to_datetime(df['date']).dt.isocalendar().week",
    },
    {
      category: "Time / Seasonality",
      name: "Peak Season Flag",
      code: "df['peak'] = df['month'].isin([11,12]).astype(int)",
    },
    {
      category: "Time / Seasonality",
      name: "Sales Seasonality Index",
      code: "df['seas_idx'] = df.groupby('week')['revenue'].transform('mean') / df['revenue'].mean()",
    },
    {
      category: "Time / Seasonality",
      name: "Holiday Proximity Feature",
      code: "df['days_to_xmas'] = (pd.Timestamp('2024-12-25') - pd.to_datetime(df['date'])).dt.days.clip(lower=0)",
    },
    {
      category: "Time / Seasonality",
      name: "Payday Week Flag",
      code: "df['payday_week'] = df['date'].apply(lambda d: 1 if pd.Timestamp(d).day in range(25,32) or pd.Timestamp(d).day <= 5 else 0)",
    },
    {
      category: "Time / Seasonality",
      name: "Cyclical Hour Sin",
      code: "df['hour_sin'] = np.sin(2*np.pi*df['hour']/24)",
    },
    {
      category: "Time / Seasonality",
      name: "Cyclical Hour Cos",
      code: "df['hour_cos'] = np.cos(2*np.pi*df['hour']/24)",
    },
    {
      category: "Time / Seasonality",
      name: "Rolling 7d Orders",
      code: "df['roll7_orders'] = df['orders'].rolling(7).sum()",
    },
    {
      category: "Time / Seasonality",
      name: "YoY GMV Growth",
      code: "df['yoy_gmv'] = df.groupby(df['date'].dt.isocalendar().week)['gmv'].pct_change()",
    },
    {
      category: "Time / Seasonality",
      name: "Weekend Revenue Uplift",
      code: "df['wknd_uplift'] = df[df['dow']>=5]['revenue'].mean() / df[df['dow']<5]['revenue'].mean() - 1",
    },
  ],
  LOGISTICS: [
    {
      category: "Delivery Performance",
      name: "On-Time Delivery Rate",
      code: "df['otd'] = (df['actual_dt'] <= df['scheduled_dt']).mean()",
    },
    {
      category: "Delivery Performance",
      name: "On-Time In-Full (OTIF)",
      code: "df['otif'] = (df['on_time'] & df['in_full']).mean()",
    },
    {
      category: "Delivery Performance",
      name: "Delivery Lateness (days)",
      code: "df['lateness'] = (df['actual_dt'] - df['scheduled_dt']).dt.days",
    },
    {
      category: "Delivery Performance",
      name: "Early Delivery Rate",
      code: "df['early_rate'] = (df['actual_dt'] < df['scheduled_dt']).mean()",
    },
    {
      category: "Delivery Performance",
      name: "Average Delivery Time",
      code: "df['avg_del'] = (df['delivered_at'] - df['dispatched_at']).dt.total_seconds() / 3600",
    },
    {
      category: "Delivery Performance",
      name: "First Attempt Success Rate",
      code: "df['first_att'] = (df['delivery_attempt'] == 1).mean()",
    },
    {
      category: "Delivery Performance",
      name: "Failed Delivery Rate",
      code: "df['fail_del'] = df['failed_deliveries'] / df['total_deliveries']",
    },
    {
      category: "Delivery Performance",
      name: "Reattempt Rate",
      code: "df['reattempt'] = (df['delivery_attempt'] > 1).mean()",
    },
    {
      category: "Delivery Performance",
      name: "Return to Sender Rate",
      code: "df['rts_rate'] = df['returned_to_sender'] / df['shipments']",
    },
    {
      category: "Delivery Performance",
      name: "Perfect Delivery Rate",
      code: "df['perfect_del'] = (df['on_time'] & df['undamaged'] & df['complete']).mean()",
    },
    {
      category: "Delivery Performance",
      name: "Exception Rate",
      code: "df['exception_rate'] = df['exceptions'] / df['shipments']",
    },
    {
      category: "Delivery Performance",
      name: "Transit Time Variability",
      code: "df['tt_var'] = df['transit_days'].std()",
    },
    {
      category: "Delivery Performance",
      name: "Carrier SLA Compliance",
      code: "df.groupby('carrier')['sla_met'].mean()",
    },
    {
      category: "Delivery Performance",
      name: "Overdue Shipments",
      code: "df['overdue'] = (df['lateness'] > 0).astype(int)",
    },
    {
      category: "Delivery Performance",
      name: "Avg Days Late",
      code: "df['avg_days_late'] = df[df['lateness']>0]['lateness'].mean()",
    },
    {
      category: "Fleet & Transport",
      name: "Fleet Utilization Rate",
      code: "df['fleet_util'] = df['active_vehicles'] / df['total_vehicles']",
    },
    {
      category: "Fleet & Transport",
      name: "Vehicle Load Factor",
      code: "df['load_factor'] = df['actual_load'] / df['max_capacity']",
    },
    {
      category: "Fleet & Transport",
      name: "Empty Miles %",
      code: "df['empty_pct'] = df['empty_miles'] / df['total_miles']",
    },
    {
      category: "Fleet & Transport",
      name: "Fuel Efficiency (MPG)",
      code: "df['mpg'] = df['miles_driven'] / df['gallons_used']",
    },
    {
      category: "Fleet & Transport",
      name: "Fuel Cost per Mile",
      code: "df['fuel_cpm'] = df['fuel_cost'] / df['miles']",
    },
    {
      category: "Fleet & Transport",
      name: "Cost per Delivery",
      code: "df['cpd'] = df['total_cost'] / df['deliveries']",
    },
    {
      category: "Fleet & Transport",
      name: "Cost per Mile",
      code: "df['cpm'] = df['total_cost'] / df['miles']",
    },
    {
      category: "Fleet & Transport",
      name: "Stops per Route",
      code: "df['stops_per_route'] = df.groupby('route_id')['stop_id'].transform('count')",
    },
    {
      category: "Fleet & Transport",
      name: "Route Efficiency Score",
      code: "df['route_eff'] = df['planned_miles'] / df['actual_miles']",
    },
    {
      category: "Fleet & Transport",
      name: "Vehicle Downtime %",
      code: "df['veh_dt'] = df['downtime_hrs'] / df['total_hrs']",
    },
    {
      category: "Fleet & Transport",
      name: "Driver Score",
      code: "df['driver_score'] = 100 - df['harsh_events'] * 2 - df['idle_pct'] * 0.5",
    },
    {
      category: "Fleet & Transport",
      name: "Idle Time %",
      code: "df['idle_pct'] = df['idle_hours'] / df['total_hours']",
    },
    {
      category: "Fleet & Transport",
      name: "Avg Speed",
      code: "df['avg_speed'] = df['miles'] / df['hours']",
    },
    {
      category: "Fleet & Transport",
      name: "CO2 per Delivery",
      code: "df['co2_del'] = df['fuel_liters'] * 2.68 / df['deliveries']",
    },
    {
      category: "Fleet & Transport",
      name: "Maintenance Cost per Vehicle",
      code: "df.groupby('vehicle_id')['maint_cost'].sum() / df.groupby('vehicle_id')['months'].max()",
    },
    {
      category: "Fleet & Transport",
      name: "Fleet Age (avg years)",
      code: "df['fleet_age'] = (pd.Timestamp.today() - pd.to_datetime(df['purchase_date'])).dt.days / 365",
    },
    {
      category: "Fleet & Transport",
      name: "Tyre Cost per km",
      code: "df['tyre_cpkm'] = df['tyre_cost'] / df['km_driven']",
    },
    {
      category: "Fleet & Transport",
      name: "Capacity Utilization by Lane",
      code: "df.groupby('lane').apply(lambda x: x['load'].sum()/x['capacity'].sum())",
    },
    {
      category: "Warehouse",
      name: "Order Picking Accuracy",
      code: "df['pick_acc'] = df['correct_picks'] / df['total_picks']",
    },
    {
      category: "Warehouse",
      name: "Pick Rate (units/hr)",
      code: "df['pick_rate'] = df['units_picked'] / df['labor_hours']",
    },
    {
      category: "Warehouse",
      name: "Lines per Order",
      code: "df['lpo'] = df['order_lines'] / df['orders']",
    },
    {
      category: "Warehouse",
      name: "Order Cycle Time",
      code: "df['order_ct'] = (df['ship_time'] - df['receive_time']).dt.total_seconds() / 3600",
    },
    {
      category: "Warehouse",
      name: "Dock to Stock Time",
      code: "df['d2s'] = (df['putaway_time'] - df['receiving_time']).dt.total_seconds() / 3600",
    },
    {
      category: "Warehouse",
      name: "Space Utilization",
      code: "df['space_util'] = df['occupied_sqft'] / df['total_sqft']",
    },
    {
      category: "Warehouse",
      name: "Cube Utilization",
      code: "df['cube_util'] = df['occupied_cbm'] / df['total_cbm']",
    },
    {
      category: "Warehouse",
      name: "Inventory Accuracy (WH)",
      code: "df['inv_acc'] = df['system_qty'].eq(df['physical_qty']).mean()",
    },
    {
      category: "Warehouse",
      name: "Inbound Units per Hour",
      code: "df['inbound_uph'] = df['received_units'] / df['inbound_hours']",
    },
    {
      category: "Warehouse",
      name: "Outbound Units per Hour",
      code: "df['outbound_uph'] = df['shipped_units'] / df['outbound_hours']",
    },
    {
      category: "Warehouse",
      name: "Return Processing Time",
      code: "df['ret_proc'] = (df['restocked_time'] - df['return_received_time']).dt.hours",
    },
    {
      category: "Warehouse",
      name: "Labor Cost per Unit",
      code: "df['labor_cpu'] = df['labor_cost'] / df['units_processed']",
    },
    {
      category: "Warehouse",
      name: "Pallet Utilization",
      code: "df['pallet_util'] = df['used_pallet_positions'] / df['total_pallet_positions']",
    },
    {
      category: "Warehouse",
      name: "Damage Rate",
      code: "df['damage_rate'] = df['damaged_units'] / df['handled_units']",
    },
    {
      category: "Warehouse",
      name: "Location Fill Rate",
      code: "df['loc_fill'] = df['occupied_locations'] / df['total_locations']",
    },
    {
      category: "Warehouse",
      name: "Cross-dock Rate",
      code: "df['xdock_rate'] = df['crossdock_units'] / df['received_units']",
    },
    {
      category: "Last Mile",
      name: "Cost per Stop",
      code: "df['cps'] = df['total_cost'] / df['stops']",
    },
    {
      category: "Last Mile",
      name: "Stops per Hour",
      code: "df['sph'] = df['stops'] / df['hours']",
    },
    {
      category: "Last Mile",
      name: "Delivery Density",
      code: "df['density'] = df['stops'] / df['route_miles']",
    },
    {
      category: "Last Mile",
      name: "Service Time per Stop",
      code: "df['svc_time'] = df['total_service_mins'] / df['stops']",
    },
    {
      category: "Last Mile",
      name: "Delivery Window Compliance",
      code: "df['window_comp'] = df['delivered_in_window'] / df['deliveries_with_window']",
    },
    {
      category: "Last Mile",
      name: "Customer Satisfaction (CSAT)",
      code: "df['csat'] = df[df['rating']>=4].shape[0] / df.shape[0]",
    },
    {
      category: "Last Mile",
      name: "Contactless Delivery Rate",
      code: "df['contactless'] = (df['delivery_type']=='contactless').mean()",
    },
    {
      category: "Last Mile",
      name: "Safe Place Delivery Rate",
      code: "df['safe_place'] = (df['delivery_type']=='safe_place').mean()",
    },
    {
      category: "Last Mile",
      name: "Geofence Compliance",
      code: "df['geo_comp'] = df['within_geofence'] / df['total_stops']",
    },
    {
      category: "Last Mile",
      name: "Proof of Delivery Rate",
      code: "df['pod_rate'] = df['pod_captured'] / df['deliveries']",
    },
    {
      category: "Last Mile",
      name: "Urban vs Rural Cost Ratio",
      code: "df.groupby('area_type')['cost_per_delivery'].mean()",
    },
    {
      category: "Last Mile",
      name: "Delivery Time Window Adherence",
      code: "df['tw_adh'] = (df['delivery_time'].between(df['window_start'],df['window_end'])).mean()",
    },
    {
      category: "Freight / Cost",
      name: "Freight Cost per KG",
      code: "df['fcpkg'] = df['freight_cost'] / df['weight_kg']",
    },
    {
      category: "Freight / Cost",
      name: "Freight Cost per Unit",
      code: "df['fcpu'] = df['freight_cost'] / df['units']",
    },
    {
      category: "Freight / Cost",
      name: "Freight Cost % of Revenue",
      code: "df['freight_pct'] = df['freight_cost'] / df['revenue']",
    },
    {
      category: "Freight / Cost",
      name: "Carrier Surcharge Rate",
      code: "df['surcharge_rate'] = df['surcharges'] / df['base_freight']",
    },
    {
      category: "Freight / Cost",
      name: "Mode Split (road vs air)",
      code: "df.groupby('transport_mode')['shipments'].sum() / df['shipments'].sum()",
    },
    {
      category: "Freight / Cost",
      name: "Landed Cost",
      code: "df['landed'] = df['product_cost'] + df['freight'] + df['duties'] + df['insurance']",
    },
    {
      category: "Freight / Cost",
      name: "Carrier Cost Index",
      code: "df['carrier_idx'] = df.groupby('carrier')['freight_cost'].transform('mean') / df['freight_cost'].mean()",
    },
    {
      category: "Freight / Cost",
      name: "Freight Audit Savings",
      code: "df['audit_savings'] = df['billed_amount'] - df['correct_amount']",
    },
    {
      category: "Freight / Cost",
      name: "Volumetric Weight",
      code: "df['vol_weight'] = df['length_cm'] * df['width_cm'] * df['height_cm'] / 5000",
    },
    {
      category: "Freight / Cost",
      name: "Chargeable Weight",
      code: "df['chargeable'] = df[['actual_weight_kg','vol_weight']].max(axis=1)",
    },
    {
      category: "Freight / Cost",
      name: "LTL vs FTL Rate Diff",
      code: "df['ltl_premium'] = df[df['mode']=='LTL']['rate_per_kg'].mean() / df[df['mode']=='FTL']['rate_per_kg'].mean() - 1",
    },
  ],
  SUPPLY_CHAIN: [
    {
      category: "Procurement",
      name: "Spend by Category",
      code: "df.groupby('category')['spend'].sum()",
    },
    {
      category: "Procurement",
      name: "Spend Concentration (HHI)",
      code: "shares = df.groupby('supplier')['spend'].sum()/df['spend'].sum(); df['hhi']=(shares**2).sum()",
    },
    {
      category: "Procurement",
      name: "Savings Realised",
      code: "df['savings'] = (df['target_price'] - df['actual_price']) * df['quantity']",
    },
    {
      category: "Procurement",
      name: "Cost Avoidance",
      code: "df['cost_avoid'] = (df['market_price'] - df['contracted_price']) * df['qty']",
    },
    {
      category: "Procurement",
      name: "PO Cycle Time",
      code: "df['po_ct'] = (df['po_approved_date'] - df['requisition_date']).dt.days",
    },
    {
      category: "Procurement",
      name: "Supplier Lead Time",
      code: "df['sup_lt'] = (df['receipt_date'] - df['po_date']).dt.days",
    },
    {
      category: "Procurement",
      name: "Lead Time Variability",
      code: "df.groupby('supplier_id')['sup_lt'].std()",
    },
    {
      category: "Procurement",
      name: "PO Compliance Rate",
      code: "df['po_comp'] = df['po_line_qty'] / df['requisition_qty']",
    },
    {
      category: "Procurement",
      name: "Maverick Spend %",
      code: "df['maverick'] = df[df['is_contracted']==False]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Procurement",
      name: "Contract Coverage Rate",
      code: "df['contract_cov'] = df[df['has_contract']==True]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Procurement",
      name: "PO First-Time Right Rate",
      code: "df['po_ftr'] = df[df['po_changes']==0]['po_id'].nunique() / df['po_id'].nunique()",
    },
    {
      category: "Procurement",
      name: "Supplier Diversity %",
      code: "df['div_spend'] = df[df['is_diverse']==True]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Procurement",
      name: "Preferential Pricing Index",
      code: "df['ppi'] = df['contracted_price'] / df['market_price']",
    },
    {
      category: "Procurement",
      name: "Spend per PO",
      code: "df['spend_po'] = df['spend'] / df['po_count']",
    },
    {
      category: "Procurement",
      name: "Invoice Match Rate",
      code: "df['inv_match'] = df['matched_invoices'] / df['total_invoices']",
    },
    {
      category: "Demand Planning",
      name: "Forecast Accuracy",
      code: "df['fa'] = 1 - abs(df['forecast']-df['actual'])/df['actual']",
    },
    {
      category: "Demand Planning",
      name: "MAPE",
      code: "df['mape'] = (abs(df['forecast']-df['actual'])/df['actual']).mean()*100",
    },
    {
      category: "Demand Planning",
      name: "Bias (over/under forecast)",
      code: "df['bias'] = (df['forecast'] - df['actual']).mean()",
    },
    {
      category: "Demand Planning",
      name: "Safety Stock (normal dist)",
      code: "df['ss'] = 1.65 * df['demand_std'] * np.sqrt(df['lead_time'])",
    },
    {
      category: "Demand Planning",
      name: "Service Level Achieved",
      code: "df['svc_lvl'] = df['demand_met'] / df['demand_total']",
    },
    {
      category: "Demand Planning",
      name: "Fill Rate",
      code: "df['fill_rate'] = df['units_shipped'] / df['units_ordered']",
    },
    {
      category: "Demand Planning",
      name: "Backorder Fill Rate",
      code: "df['bo_fill'] = df['backordered_filled'] / df['backordered']",
    },
    {
      category: "Demand Planning",
      name: "Demand Variability (CV)",
      code: "df['cv'] = df.groupby('sku')['demand'].transform('std') / df.groupby('sku')['demand'].transform('mean')",
    },
    {
      category: "Demand Planning",
      name: "XYZ Classification",
      code: "df['xyz'] = pd.cut(df['cv'], bins=[0,0.1,0.25,9999], labels=['X','Y','Z'])",
    },
    {
      category: "Demand Planning",
      name: "Demand Sensing (short term)",
      code: "df['ds_signal'] = df['demand'].ewm(span=3).mean()",
    },
    {
      category: "Demand Planning",
      name: "Promotion Demand Lift",
      code: "df['promo_lift'] = df[df['promo']==1]['demand'].mean() / df[df['promo']==0]['demand'].mean()",
    },
    {
      category: "Demand Planning",
      name: "Rolling 4w Demand",
      code: "df['demand_4w'] = df['demand'].rolling(4).sum()",
    },
    {
      category: "Demand Planning",
      name: "Demand at Risk",
      code: "df['dar'] = df['demand'] * (1 - df['supply_probability'])",
    },
    {
      category: "Demand Planning",
      name: "Forecast vs Actual Heatmap",
      code: "df.pivot_table(index='sku',columns='week',values='forecast_error').style.background_gradient()",
    },
    {
      category: "Demand Planning",
      name: "Intermittent Demand Flag",
      code: "df['intermittent'] = (df['demand']==0).mean() > 0.5",
    },
    {
      category: "Inventory Management",
      name: "Inventory Turnover",
      code: "df['inv_turn'] = df['cogs'] / df['avg_inventory']",
    },
    {
      category: "Inventory Management",
      name: "Days on Hand",
      code: "df['doh'] = df['inventory'] / (df['cogs'] / 365)",
    },
    {
      category: "Inventory Management",
      name: "Excess Inventory Value",
      code: "df['excess'] = np.maximum(df['inventory'] - df['target_inv'], 0) * df['unit_cost']",
    },
    {
      category: "Inventory Management",
      name: "Inventory Carrying Cost",
      code: "df['carry_cost'] = df['avg_inventory_value'] * df['holding_rate']",
    },
    {
      category: "Inventory Management",
      name: "EOQ",
      code: "df['eoq'] = np.sqrt(2*df['annual_demand']*df['order_cost']/df['holding_cost_unit'])",
    },
    {
      category: "Inventory Management",
      name: "Reorder Point",
      code: "df['rop'] = df['avg_daily_demand'] * df['lead_time'] + df['safety_stock']",
    },
    {
      category: "Inventory Management",
      name: "Obsolescence Rate",
      code: "df['obs'] = df[df['last_used_days']>365]['value'].sum() / df['total_inventory_value'].iloc[0]",
    },
    {
      category: "Inventory Management",
      name: "Lot Size Efficiency",
      code: "df['lot_eff'] = df['eoq'] / df['actual_lot_size']",
    },
    {
      category: "Inventory Management",
      name: "Replenishment Cycle",
      code: "df['rep_cycle'] = df['eoq'] / df['avg_daily_demand']",
    },
    {
      category: "Inventory Management",
      name: "Max Stock Level",
      code: "df['max_stock'] = df['rop'] + df['eoq']",
    },
    {
      category: "Inventory Management",
      name: "Min Stock Level",
      code: "df['min_stock'] = df['safety_stock']",
    },
    {
      category: "Inventory Management",
      name: "Inventory Health Score",
      code: "df['inv_health'] = (df['fill_rate']*0.4 + (1-df['excess_rate'])*0.3 + df['accuracy']*0.3)",
    },
    {
      category: "Inventory Management",
      name: "ABC-XYZ Matrix",
      code: "df['abc_xyz'] = df['abc'] + df['xyz']",
    },
    {
      category: "Inventory Management",
      name: "Stock Coverage Weeks",
      code: "df['cov_wks'] = df['inventory'] / (df['weekly_demand']+1e-9)",
    },
    {
      category: "Inventory Management",
      name: "Virtual Inventory (in-transit)",
      code: "df['virtual_inv'] = df['on_hand'] + df['in_transit'] - df['committed']",
    },
    {
      category: "Supplier Management",
      name: "Supplier Scorecard",
      code: "df['sup_score'] = df['quality']*0.35 + df['delivery']*0.35 + df['price']*0.2 + df['responsiveness']*0.1",
    },
    {
      category: "Supplier Management",
      name: "Supplier OTD Rate",
      code: "df.groupby('supplier_id')['on_time'].mean()",
    },
    {
      category: "Supplier Management",
      name: "Supplier Defect Rate",
      code: "df.groupby('supplier_id').apply(lambda x: x['defects'].sum()/x['qty_received'].sum())",
    },
    {
      category: "Supplier Management",
      name: "Supplier Risk Score",
      code: "df['sup_risk'] = df['single_source_flag']*3 + df['geopolitical_risk'] + df['financial_risk']",
    },
    {
      category: "Supplier Management",
      name: "Supplier Dependency %",
      code: "df['dep_pct'] = df.groupby('supplier')['spend'].transform('sum') / df['spend'].sum()",
    },
    {
      category: "Supplier Management",
      name: "Supplier Count by Category",
      code: "df.groupby('category')['supplier_id'].nunique()",
    },
    {
      category: "Supplier Management",
      name: "Preferred Supplier Rate",
      code: "df['pref_rate'] = df[df['preferred']==True]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Supplier Management",
      name: "Supplier Invoice Accuracy",
      code: "df.groupby('supplier_id')['invoice_match'].mean()",
    },
    {
      category: "Supplier Management",
      name: "New Supplier Onboarding Time",
      code: "df['onboard_days'] = (df['first_po_date'] - df['approval_date']).dt.days",
    },
    {
      category: "Supplier Management",
      name: "Supplier NPS",
      code: "df['sup_nps'] = df[df['sup_score']>=9].shape[0] / df.shape[0]*100 - df[df['sup_score']<=6].shape[0] / df.shape[0]*100",
    },
    {
      category: "Risk & Resilience",
      name: "Supply Chain Disruption Score",
      code: "df['disrupt'] = df['disrupted_suppliers'] / df['total_suppliers']",
    },
    {
      category: "Risk & Resilience",
      name: "Single Source Exposure",
      code: "df['ss_exposure'] = df[df['single_source']==1]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Risk & Resilience",
      name: "Geopolitical Risk Index",
      code: "df['geo_risk'] = df['supplier_country'].map(country_risk_dict)",
    },
    {
      category: "Risk & Resilience",
      name: "Buffer Stock Coverage",
      code: "df['buffer_cov'] = df['safety_stock'] / df['avg_daily_demand']",
    },
    {
      category: "Risk & Resilience",
      name: "SCRM Score",
      code: "df['scrm'] = df[['geo_risk','fin_risk','ops_risk','esg_risk']].mean(axis=1)",
    },
    {
      category: "Risk & Resilience",
      name: "Recovery Time Objective",
      code: "df['rto_days'] = df['alt_supplier_lt'] + df['switching_time']",
    },
    {
      category: "Risk & Resilience",
      name: "Supply Chain Complexity",
      code: "df['complexity'] = df['tiers'] * df['nodes_per_tier']",
    },
    {
      category: "Risk & Resilience",
      name: "Multi-source Spend %",
      code: "df['multi_src'] = df.groupby('component')['supplier_id'].transform('nunique').gt(1).astype(int)",
    },
    {
      category: "Risk & Resilience",
      name: "Supplier Financial Health (Z-score proxy)",
      code: "df['sup_fin'] = df['supplier_current_ratio'] * 0.5 + df['supplier_de_ratio_inv'] * 0.5",
    },
    {
      category: "Risk & Resilience",
      name: "Climate Risk Exposure",
      code: "df['climate_risk'] = df['supplier_location'].map(climate_risk_dict)",
    },
    {
      category: "Sustainability",
      name: "Scope 3 Emissions (suppliers)",
      code: "df['scope3'] = df['spend'] * df['emission_factor_per_dollar']",
    },
    {
      category: "Sustainability",
      name: "Sustainable Sourcing %",
      code: "df['sus_pct'] = df[df['eco_certified']==1]['spend'].sum() / df['spend'].sum()",
    },
    {
      category: "Sustainability",
      name: "Packaging Waste per Unit",
      code: "df['pkg_waste'] = df['packaging_weight_g'] / df['units']",
    },
    {
      category: "Sustainability",
      name: "Recycled Material Content",
      code: "df['recycled_pct'] = df['recycled_kg'] / df['total_material_kg']",
    },
    {
      category: "Sustainability",
      name: "Water Intensity",
      code: "df['water_intensity'] = df['water_liters'] / df['revenue']",
    },
    {
      category: "Sustainability",
      name: "Carbon Cost per Unit",
      code: "df['carbon_cpu'] = df['co2e_kg'] * df['carbon_price'] / df['units']",
    },
    {
      category: "Sustainability",
      name: "ESG Supplier Score",
      code: "df['esg_sup'] = df[['env_score','social_score','gov_score']].mean(axis=1)",
    },
    {
      category: "Sustainability",
      name: "Circular Economy Rate",
      code: "df['circular_rate'] = (df['reused'] + df['recycled']) / df['total_material']",
    },
    {
      category: "Sustainability",
      name: "Transport Emissions per Tonne-KM",
      code: "df['transport_ef'] = df['co2e_kg'] / (df['weight_tonnes'] * df['distance_km'])",
    },
    {
      category: "Sustainability",
      name: "Renewable Energy Share (supplier)",
      code: "df['renew_share'] = df['renewable_kwh'] / df['total_kwh']",
    },
  ],
  TELECOM: [
    {
      category: "Network Performance",
      name: "Network Availability",
      code: "df['availability'] = df['uptime_mins'] / df['total_mins']",
    },
    {
      category: "Network Performance",
      name: "Packet Loss Rate",
      code: "df['pkt_loss'] = df['lost_packets'] / df['sent_packets']",
    },
    {
      category: "Network Performance",
      name: "Latency P95",
      code: "df['latency_p95'] = df['latency_ms'].quantile(0.95)",
    },
    {
      category: "Network Performance",
      name: "Jitter",
      code: "df['jitter'] = df['latency_ms'].diff().abs().mean()",
    },
    {
      category: "Network Performance",
      name: "Throughput Utilization",
      code: "df['throughput_util'] = df['actual_throughput'] / df['max_throughput']",
    },
    {
      category: "Network Performance",
      name: "RSSI Avg",
      code: "df['rssi_avg'] = df['rssi'].rolling(10).mean()",
    },
    {
      category: "Network Performance",
      name: "Signal Quality Score",
      code: "df['sig_qual'] = pd.cut(df['rssi_dbm'], bins=[-120,-90,-70,-50,0], labels=[1,2,3,4]).astype(int)",
    },
    {
      category: "Network Performance",
      name: "Cell Load Factor",
      code: "df['cell_load'] = df['prb_utilization'] / df['max_prb']",
    },
    {
      category: "Network Performance",
      name: "Handover Success Rate",
      code: "df['ho_success'] = df['successful_handovers'] / df['attempted_handovers']",
    },
    {
      category: "Network Performance",
      name: "Drop Call Rate",
      code: "df['dcr'] = df['dropped_calls'] / df['total_calls']",
    },
    {
      category: "Network Performance",
      name: "Block Call Rate",
      code: "df['bcr'] = df['blocked_calls'] / df['attempted_calls']",
    },
    {
      category: "Network Performance",
      name: "VOLTE Usage Rate",
      code: "df['volte_rate'] = df['volte_calls'] / df['total_calls']",
    },
    {
      category: "Network Performance",
      name: "Data Session Drop Rate",
      code: "df['data_drop'] = df['dropped_sessions'] / df['total_sessions']",
    },
    {
      category: "Network Performance",
      name: "Active Users per Cell",
      code: "df['users_cell'] = df['active_users'] / df['active_cells']",
    },
    {
      category: "Network Performance",
      name: "Traffic per Cell (GB)",
      code: "df['traffic_cell'] = df['total_gb'] / df['active_cells']",
    },
    {
      category: "Network Performance",
      name: "Network Congestion Index",
      code: "df['congestion'] = df['cell_load'] * (1 - df['availability'])",
    },
    {
      category: "Network Performance",
      name: "SLA Breach Rate",
      code: "df['sla_breach'] = df['sla_violations'] / df['total_sla_checks']",
    },
    {
      category: "Network Performance",
      name: "Fault Detection Time",
      code: "df['fdt'] = (df['fault_detected'] - df['fault_started']).dt.total_seconds() / 60",
    },
    {
      category: "Network Performance",
      name: "MTTR Network",
      code: "df['mttr'] = df['repair_time_mins'].mean()",
    },
    {
      category: "Network Performance",
      name: "Downtime Hours per Month",
      code: "df['dt_hrs'] = df.groupby(df['date'].dt.to_period('M'))['downtime_mins'].sum() / 60",
    },
    {
      category: "Subscriber / Revenue",
      name: "ARPU (Monthly)",
      code: "df['arpu'] = df['monthly_revenue'] / df['active_subscribers']",
    },
    {
      category: "Subscriber / Revenue",
      name: "ARPU Trend",
      code: "df['arpu_trend'] = df['arpu'].pct_change()",
    },
    {
      category: "Subscriber / Revenue",
      name: "ARPU by Segment",
      code: "df.groupby('segment')['arpu'].mean()",
    },
    {
      category: "Subscriber / Revenue",
      name: "ARPPU (paying users)",
      code: "df['arppu'] = df['revenue'] / df['paying_users']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Revenue per GB",
      code: "df['rpgb'] = df['data_revenue'] / df['gb_consumed']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Voice Revenue per Min",
      code: "df['voice_rpm'] = df['voice_revenue'] / df['minutes_of_use']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Data Revenue Share",
      code: "df['data_share'] = df['data_revenue'] / df['total_revenue']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Roaming Revenue",
      code: "df['roaming_share'] = df['roaming_revenue'] / df['total_revenue']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Net Adds",
      code: "df['net_adds'] = df['new_subscribers'] - df['churned_subscribers']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Subscriber Growth Rate",
      code: "df['sub_growth'] = df['net_adds'] / df['subscribers_start']",
    },
    {
      category: "Subscriber / Revenue",
      name: "Postpaid Mix",
      code: "df['postpaid_mix'] = df['postpaid_subs'] / df['total_subs']",
    },
    {
      category: "Subscriber / Revenue",
      name: "MNP Win Rate",
      code: "df['mnp_win'] = df['mnp_in'] / (df['mnp_in'] + df['mnp_out'])",
    },
    {
      category: "Subscriber / Revenue",
      name: "SIM-only vs Device Mix",
      code: "df['sim_only_share'] = df['sim_only_subs'] / df['total_subs']",
    },
    {
      category: "Churn",
      name: "Monthly Churn Rate",
      code: "df['churn_rate'] = df['churned'] / df['active_start']",
    },
    {
      category: "Churn",
      name: "Annual Churn Rate",
      code: "df['annual_churn'] = 1 - (1 - df['monthly_churn'])**12",
    },
    {
      category: "Churn",
      name: "Voluntary vs Involuntary Churn",
      code: "df.groupby('churn_type')['churned'].sum() / df['churned'].sum()",
    },
    {
      category: "Churn",
      name: "Days on Network at Churn",
      code: "df['tenure_at_churn'] = (df['churn_date'] - df['activation_date']).dt.days",
    },
    {
      category: "Churn",
      name: "Churn Propensity Score",
      code: "df['churn_score'] = df[['complaints_30d','data_drop_rate','missed_payments']].dot([0.35,0.30,0.35])",
    },
    {
      category: "Churn",
      name: "Early Life Churn (< 90 days)",
      code: "df['early_churn'] = ((df['tenure_at_churn']<90) & (df['churned']==1)).astype(int)",
    },
    {
      category: "Churn",
      name: "Contract Expiry Churn Risk",
      code: "df['contract_risk'] = (df['days_to_contract_end'] <= 30).astype(int)",
    },
    {
      category: "Churn",
      name: "NPS vs Churn Correlation",
      code: "df[['nps_score','churned']].corr()",
    },
    {
      category: "Churn",
      name: "Revenue Churn Rate",
      code: "df['rev_churn'] = df['churned_revenue'] / df['beginning_revenue']",
    },
    {
      category: "Churn",
      name: "Reactivation Rate",
      code: "df['react_rate'] = df['reactivated'] / df['prev_churned']",
    },
    {
      category: "Churn",
      name: "Average Revenue Lost per Churn",
      code: "df['arpl_churn'] = df['churned_revenue'] / df['churned']",
    },
    {
      category: "Usage / Data",
      name: "Average Data Usage per User (GB)",
      code: "df['avg_gb'] = df['total_gb'] / df['active_users']",
    },
    {
      category: "Usage / Data",
      name: "Voice Minutes of Use",
      code: "df['mou'] = df['total_minutes'] / df['voice_subscribers']",
    },
    {
      category: "Usage / Data",
      name: "SMS per User",
      code: "df['sms_pu'] = df['total_sms'] / df['sms_users']",
    },
    {
      category: "Usage / Data",
      name: "Peak Hour Traffic Ratio",
      code: "df['peak_ratio'] = df[df['hour'].between(18,21)]['traffic_gb'].mean() / df['traffic_gb'].mean()",
    },
    {
      category: "Usage / Data",
      name: "Data Usage Growth MoM",
      code: "df['data_growth'] = df['total_gb'].pct_change()",
    },
    {
      category: "Usage / Data",
      name: "Heavy User Flag (>10GB)",
      code: "df['heavy_user'] = (df['monthly_gb'] > 10).astype(int)",
    },
    {
      category: "Usage / Data",
      name: "Zero Usage Flag",
      code: "df['zero_usage'] = (df['monthly_gb'] == 0).astype(int)",
    },
    {
      category: "Usage / Data",
      name: "Overage Revenue",
      code: "df['overage_rev'] = df['gb_over_plan'] * df['overage_rate']",
    },
    {
      category: "Usage / Data",
      name: "Plan Utilization Rate",
      code: "df['plan_util'] = df['used_gb'] / df['plan_gb']",
    },
    {
      category: "Usage / Data",
      name: "Roaming Data Usage",
      code: "df['roam_gb_share'] = df['roaming_gb'] / df['total_gb']",
    },
    {
      category: "Usage / Data",
      name: "Night Time Usage %",
      code: "df['night_usage'] = df[df['hour'].between(22,6)]['traffic_gb'].sum() / df['traffic_gb'].sum()",
    },
    {
      category: "Customer Care",
      name: "First Call Resolution",
      code: "df['fcr'] = df['resolved_first_call'] / df['total_calls']",
    },
    {
      category: "Customer Care",
      name: "Average Handle Time",
      code: "df['aht'] = df['total_handle_time_s'] / df['calls']",
    },
    {
      category: "Customer Care",
      name: "Abandon Rate",
      code: "df['abandon_rate'] = df['abandoned_calls'] / df['total_inbound']",
    },
    {
      category: "Customer Care",
      name: "Service Level (20s)",
      code: "df['svc_lvl'] = df['answered_20s'] / df['total_calls']",
    },
    {
      category: "Customer Care",
      name: "Contacts per Customer",
      code: "df['cpc'] = df['contacts'] / df['customers']",
    },
    {
      category: "Customer Care",
      name: "Digital Self-Service Rate",
      code: "df['digital_rate'] = df['digital_contacts'] / df['total_contacts']",
    },
    {
      category: "Customer Care",
      name: "Repeat Contact Rate",
      code: "df['repeat_contact'] = df['contacts_within_7d'] / df['total_contacts']",
    },
    {
      category: "Customer Care",
      name: "Escalation Rate",
      code: "df['escal_rate'] = df['escalated_contacts'] / df['total_contacts']",
    },
    {
      category: "Customer Care",
      name: "Cost per Contact",
      code: "df['cpc_cost'] = df['care_cost'] / df['contacts']",
    },
    {
      category: "Customer Care",
      name: "Agent Utilisation",
      code: "df['agent_util'] = df['handle_time'] / df['available_time']",
    },
    {
      category: "Customer Care",
      name: "Complaint Rate per 100 Subs",
      code: "df['complaint_rate'] = df['complaints'] / df['subscribers'] * 100",
    },
    {
      category: "Customer Care",
      name: "Regulator Complaint Rate",
      code: "df['reg_complaint'] = df['regulator_complaints'] / df['subscribers'] * 1e6",
    },
    {
      category: "Customer Care",
      name: "Care-Driven Churn %",
      code: "df['care_churn'] = df[df['churned'] & df['had_complaint']].shape[0] / df['churned'].sum()",
    },
    {
      category: "Fraud & Risk",
      name: "Revenue Assurance Leakage %",
      code: "df['ra_leak'] = df['unbilled_revenue'] / df['billed_revenue']",
    },
    {
      category: "Fraud & Risk",
      name: "SIM Box Fraud Score",
      code: "df['simbox'] = df['international_calls_ratio'] + df['avg_duration_drop']",
    },
    {
      category: "Fraud & Risk",
      name: "Bad Debt Rate",
      code: "df['bad_debt'] = df['written_off'] / df['revenue']",
    },
    {
      category: "Fraud & Risk",
      name: "Credit Risk Score",
      code: "df['credit_risk'] = df['missed_payments'] * 0.5 + df['late_days_avg'] * 0.3 + df['credit_score_inv'] * 0.2",
    },
    {
      category: "Fraud & Risk",
      name: "International Call Anomaly",
      code: "df['intl_anomaly'] = (df['intl_minutes'] > df['intl_minutes'].mean() + 3*df['intl_minutes'].std()).astype(int)",
    },
    {
      category: "Fraud & Risk",
      name: "Roaming Abuse Flag",
      code: "df['roam_abuse'] = (df['roaming_days'] > 30).astype(int)",
    },
    {
      category: "Fraud & Risk",
      name: "Chargeback Fraud Rate",
      code: "df['cb_fraud'] = df['disputed_charges'] / df['total_charges']",
    },
    {
      category: "Fraud & Risk",
      name: "Prepaid Refund Fraud Rate",
      code: "df['refund_fraud'] = df['suspicious_refunds'] / df['total_refunds']",
    },
  ],
  ENERGY: [
    {
      category: "Generation",
      name: "Capacity Factor",
      code: "df['cap_factor'] = df['actual_generation_mwh'] / (df['installed_capacity_mw'] * df['hours'])",
    },
    {
      category: "Generation",
      name: "Plant Availability Factor",
      code: "df['availability'] = df['available_hours'] / df['total_hours']",
    },
    {
      category: "Generation",
      name: "Forced Outage Rate",
      code: "df['for_rate'] = df['forced_outage_hrs'] / (df['service_hrs'] + df['forced_outage_hrs'])",
    },
    {
      category: "Generation",
      name: "Heat Rate (BTU/kWh)",
      code: "df['heat_rate'] = df['fuel_input_btu'] / df['net_generation_kwh']",
    },
    {
      category: "Generation",
      name: "Thermal Efficiency",
      code: "df['thermal_eff'] = 3412 / df['heat_rate']",
    },
    {
      category: "Generation",
      name: "Equivalent Availability Factor",
      code: "df['eaf'] = (df['available_hrs'] - df['derated_hrs']) / df['total_hrs']",
    },
    {
      category: "Generation",
      name: "Net Generation per Unit",
      code: "df['gen_pu'] = df['net_gen_mwh'] / df['fuel_units_consumed']",
    },
    {
      category: "Generation",
      name: "Renewable Energy Fraction",
      code: "df['re_fraction'] = df['renewable_mwh'] / df['total_generation_mwh']",
    },
    {
      category: "Generation",
      name: "Solar Capacity Factor",
      code: "df['solar_cf'] = df['solar_gen_kwh'] / (df['solar_kw'] * df['hours'])",
    },
    {
      category: "Generation",
      name: "Wind Capacity Factor",
      code: "df['wind_cf'] = df['wind_gen_kwh'] / (df['wind_kw'] * df['hours'])",
    },
    {
      category: "Generation",
      name: "Plant Load Factor",
      code: "df['plf'] = df['total_gen'] / (df['max_demand'] * df['hours'])",
    },
    {
      category: "Generation",
      name: "Auxiliary Consumption %",
      code: "df['aux_pct'] = df['aux_consumption_mwh'] / df['gross_gen_mwh']",
    },
    {
      category: "Generation",
      name: "Emissions Rate (kg CO2/MWh)",
      code: "df['emit_rate'] = df['co2_kg'] / df['gen_mwh']",
    },
    {
      category: "Generation",
      name: "Fuel Cost per MWh",
      code: "df['fuel_mwh'] = df['fuel_cost'] / df['net_gen_mwh']",
    },
    {
      category: "Generation",
      name: "Variable O&M per MWh",
      code: "df['vom_mwh'] = df['variable_om'] / df['net_gen_mwh']",
    },
    {
      category: "Generation",
      name: "Levelised Cost of Electricity",
      code: "df['lcoe'] = (df['capex_pv'] + df['opex_pv']) / df['lifetime_gen_mwh']",
    },
    {
      category: "Generation",
      name: "Curtailment Rate",
      code: "df['curtail'] = df['curtailed_mwh'] / (df['generated_mwh'] + df['curtailed_mwh'])",
    },
    {
      category: "Generation",
      name: "Dispatch Rate",
      code: "df['dispatch_rate'] = df['dispatched_hours'] / df['available_hours']",
    },
    {
      category: "Generation",
      name: "Reserve Margin",
      code: "df['reserve_margin'] = (df['installed_capacity'] - df['peak_demand']) / df['peak_demand']",
    },
    {
      category: "Generation",
      name: "Ramp Rate (MW/min)",
      code: "df['ramp_rate'] = df['output_mw'].diff() / df['time_min'].diff()",
    },
    {
      category: "Generation",
      name: "Start Reliability",
      code: "df['start_rel'] = df['successful_starts'] / df['attempted_starts']",
    },
    {
      category: "Generation",
      name: "Startup Cost",
      code: "df['startup_cost'] = df['fuel_startup'] + df['om_startup']",
    },
    {
      category: "Generation",
      name: "Unit Commitment Flag",
      code: "df['committed'] = (df['scheduled_mw'] > 0).astype(int)",
    },
    {
      category: "Generation",
      name: "Equivalent Forced Outage Rate",
      code: "df['efor'] = df['forced_outage_hrs'] / (df['service_hrs'] + df['forced_outage_hrs'] + df['reserve_shutdown_hrs'])",
    },
    {
      category: "Generation",
      name: "Net Capacity Factor YTD",
      code: "df['ncf_ytd'] = df.groupby([df['date'].dt.year,'unit'])['gen_mwh'].cumsum() / (df['capacity_mw'] * df.groupby([df['date'].dt.year,'unit']).cumcount()*24)",
    },
    {
      category: "T&D",
      name: "Transmission Loss %",
      code: "df['t_loss'] = (df['generated_mwh'] - df['received_mwh']) / df['generated_mwh']",
    },
    {
      category: "T&D",
      name: "Distribution Loss %",
      code: "df['d_loss'] = (df['received_mwh'] - df['billed_mwh']) / df['received_mwh']",
    },
    {
      category: "T&D",
      name: "Line Loading %",
      code: "df['loading'] = df['actual_flow_mva'] / df['thermal_limit_mva']",
    },
    {
      category: "T&D",
      name: "Voltage Deviation",
      code: "df['v_dev'] = abs(df['actual_voltage'] - df['nominal_voltage']) / df['nominal_voltage']",
    },
    {
      category: "T&D",
      name: "SAIDI",
      code: "df['saidi'] = df['sum_customer_interruption_hours'] / df['total_customers']",
    },
    {
      category: "T&D",
      name: "SAIFI",
      code: "df['saifi'] = df['total_interruptions'] / df['total_customers']",
    },
    {
      category: "T&D",
      name: "CAIDI",
      code: "df['caidi'] = df['saidi'] / df['saifi']",
    },
    {
      category: "T&D",
      name: "MAIFI (Momentary)",
      code: "df['maifi'] = df['momentary_interruptions'] / df['total_customers']",
    },
    {
      category: "T&D",
      name: "Outage Duration Avg",
      code: "df['avg_outage_dur'] = df['total_outage_mins'] / df['outage_events']",
    },
    {
      category: "T&D",
      name: "Fault Rate per km",
      code: "df['fault_rate'] = df['faults'] / df['line_km']",
    },
    {
      category: "T&D",
      name: "Transformer Utilization",
      code: "df['xfmr_util'] = df['avg_load_mva'] / df['nameplate_mva']",
    },
    {
      category: "T&D",
      name: "Power Factor",
      code: "df['pf'] = df['kw'] / df['kva']",
    },
    {
      category: "T&D",
      name: "Reactive Power Compensation",
      code: "df['q_comp'] = df['mvar_generated'] / df['mvar_consumed']",
    },
    {
      category: "T&D",
      name: "Cable Age Risk Score",
      code: "df['age_risk'] = df['cable_age_years'] / df['design_life']",
    },
    {
      category: "T&D",
      name: "Smart Meter Penetration",
      code: "df['sm_pen'] = df['smart_meters'] / df['total_meters']",
    },
    {
      category: "T&D",
      name: "AMI Data Capture Rate",
      code: "df['ami_capture'] = df['meter_reads_received'] / df['expected_reads']",
    },
    {
      category: "T&D",
      name: "Non-Technical Loss %",
      code: "df['ntl'] = (df['total_loss'] - df['technical_loss']) / df['input_energy']",
    },
    {
      category: "T&D",
      name: "Network Asset Utilization",
      code: "df['asset_util'] = df['peak_load_mva'] / df['total_capacity_mva']",
    },
    {
      category: "T&D",
      name: "Outage Frequency Index",
      code: "df['ofi'] = df['outages'] / df['customers']",
    },
    {
      category: "T&D",
      name: "Reliability Index Score",
      code: "df['reliability'] = 1 - df['saidi'] / (8760 * 60)",
    },
    {
      category: "Smart Grid & Demand",
      name: "Demand Response Activation",
      code: "df['dr_act'] = df['dr_events_called'] / df['dr_eligible_hours']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Load Forecasting Error (MAPE)",
      code: "df['lfe'] = (abs(df['forecast_mw']-df['actual_mw'])/df['actual_mw']).mean()*100",
    },
    {
      category: "Smart Grid & Demand",
      name: "Peak Demand Reduction",
      code: "df['peak_red'] = (df['peak_demand_base'] - df['peak_demand_actual']) / df['peak_demand_base']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Load Factor",
      code: "df['load_factor'] = df['avg_load'] / df['peak_load']",
    },
    {
      category: "Smart Grid & Demand",
      name: "P90 Load Level",
      code: "df['p90_load'] = df['load_mw'].quantile(0.9)",
    },
    {
      category: "Smart Grid & Demand",
      name: "EV Charging Load %",
      code: "df['ev_load_pct'] = df['ev_load_mw'] / df['total_load_mw']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Grid Flexibility Index",
      code: "df['flex_idx'] = (df['dispatchable_mw'] + df['storage_mw']) / df['total_demand_mw']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Frequency Deviation",
      code: "df['freq_dev'] = abs(df['frequency_hz'] - 50) / 50",
    },
    {
      category: "Smart Grid & Demand",
      name: "Spinning Reserve %",
      code: "df['spin_reserve'] = df['spinning_reserve_mw'] / df['total_demand_mw']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Interconnection Utilization",
      code: "df['ic_util'] = df['flow_mw'] / df['ic_capacity_mw']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Time-of-Use Shift Rate",
      code: "df['tou_shift'] = df['off_peak_load_gain'] / df['peak_load_reduction']",
    },
    {
      category: "Smart Grid & Demand",
      name: "Voltage Regulation Compliance",
      code: "df['v_comp'] = df['within_band'].mean()",
    },
    {
      category: "Smart Grid & Demand",
      name: "Behind-the-Meter Generation",
      code: "df['btm_pct'] = df['btm_gen_mwh'] / df['total_generation_mwh']",
    },
    {
      category: "Renewable Energy",
      name: "Solar Irradiance Index",
      code: "df['irr_idx'] = df['actual_irr'] / df['reference_irr']",
    },
    {
      category: "Renewable Energy",
      name: "Power Curve Coefficient",
      code: "df['cp'] = df['power_output'] / (0.5 * 1.225 * df['rotor_area'] * df['wind_speed']**3)",
    },
    {
      category: "Renewable Energy",
      name: "Capacity Factor Rolling 30d",
      code: "df['cf30'] = df['gen_mwh'].rolling(30).sum() / (df['capacity_mw'] * 24 * 30)",
    },
    {
      category: "Renewable Energy",
      name: "Solar Performance Ratio",
      code: "df['pr'] = df['actual_energy_kwh'] / (df['irradiance_kwh_m2'] * df['system_kw'])",
    },
    {
      category: "Renewable Energy",
      name: "Specific Yield (kWh/kWp)",
      code: "df['spec_yield'] = df['gen_kwh'] / df['installed_kwp']",
    },
    {
      category: "Renewable Energy",
      name: "Equivalent Full Load Hours",
      code: "df['eflh'] = df['gen_mwh'] / df['installed_mw']",
    },
    {
      category: "Renewable Energy",
      name: "REC Value per MWh",
      code: "df['rec_value'] = df['rec_price'] * df['gen_mwh']",
    },
    {
      category: "Renewable Energy",
      name: "Battery State of Charge",
      code: "df['soc'] = df['stored_energy_mwh'] / df['battery_capacity_mwh']",
    },
    {
      category: "Renewable Energy",
      name: "Battery Round-Trip Efficiency",
      code: "df['bte'] = df['energy_discharged_mwh'] / df['energy_charged_mwh']",
    },
    {
      category: "Renewable Energy",
      name: "Battery Cycle Count",
      code: "df['cycles'] = df['total_throughput_mwh'] / (2 * df['capacity_mwh'])",
    },
    {
      category: "Renewable Energy",
      name: "Wind Turbine Availability",
      code: "df['wt_avail'] = df['available_hours'] / df['total_hours']",
    },
    {
      category: "Renewable Energy",
      name: "Solar Panel Degradation",
      code: "df['degrad'] = 1 - df['current_output'] / df['nameplate_output']",
    },
    {
      category: "Renewable Energy",
      name: "Curtailment Loss Value",
      code: "df['curtail_loss'] = df['curtailed_mwh'] * df['market_price']",
    },
    {
      category: "Renewable Energy",
      name: "Capacity Credit",
      code: "df['cap_credit'] = df['reliable_capacity_mw'] / df['installed_mw']",
    },
    {
      category: "Renewable Energy",
      name: "Inverter Efficiency",
      code: "df['inv_eff'] = df['ac_output_kwh'] / df['dc_input_kwh']",
    },
    {
      category: "Trading & Markets",
      name: "Spark Spread",
      code: "df['spark'] = df['power_price'] - (df['gas_price'] * df['heat_rate'] / 3.412)",
    },
    {
      category: "Trading & Markets",
      name: "Dark Spread",
      code: "df['dark'] = df['power_price'] - (df['coal_price'] * df['heat_rate'])",
    },
    {
      category: "Trading & Markets",
      name: "Clean Spark Spread",
      code: "df['css'] = df['spark'] - df['co2_price'] * df['carbon_intensity']",
    },
    {
      category: "Trading & Markets",
      name: "Power Price Rolling Avg 30d",
      code: "df['ppa_30d'] = df['power_price'].rolling(30).mean()",
    },
    {
      category: "Trading & Markets",
      name: "Price Volatility",
      code: "df['price_vol'] = df['power_price'].pct_change().rolling(30).std() * np.sqrt(252)",
    },
    {
      category: "Trading & Markets",
      name: "Day-Ahead vs Spot Spread",
      code: "df['da_rt_spread'] = df['day_ahead_price'] - df['real_time_price']",
    },
    {
      category: "Trading & Markets",
      name: "Imbalance Cost",
      code: "df['imbal_cost'] = (df['forecasted_gen'] - df['actual_gen']) * df['imbalance_price']",
    },
    {
      category: "Trading & Markets",
      name: "Congestion Rent",
      code: "df['cong_rent'] = df['locational_marginal_diff'] * df['flow_mw']",
    },
    {
      category: "Trading & Markets",
      name: "Mark-to-Market P&L",
      code: "df['mtm'] = (df['market_price'] - df['contract_price']) * df['contracted_mwh']",
    },
    {
      category: "Trading & Markets",
      name: "Hedge Ratio",
      code: "df['hedge_ratio'] = df['hedged_volume'] / df['total_exposure']",
    },
    {
      category: "Trading & Markets",
      name: "Price Duration Curve P50",
      code: "df['p50_price'] = df['power_price'].median()",
    },
    {
      category: "Trading & Markets",
      name: "Negative Price Hours %",
      code: "df['neg_price_pct'] = (df['power_price'] < 0).mean()",
    },
    {
      category: "Customer / Retail",
      name: "Average Bill",
      code: "df['avg_bill'] = df['revenue'] / df['accounts']",
    },
    {
      category: "Customer / Retail",
      name: "Average Unit Rate (p/kWh)",
      code: "df['aur'] = df['revenue_pence'] / df['kwh']",
    },
    {
      category: "Customer / Retail",
      name: "Revenue per Customer",
      code: "df['rpc'] = df['annual_revenue'] / df['customers']",
    },
    {
      category: "Customer / Retail",
      name: "Switch Rate",
      code: "df['switch_rate'] = df['supplier_switches'] / df['total_accounts']",
    },
    {
      category: "Customer / Retail",
      name: "Bad Debt Rate",
      code: "df['bad_debt'] = df['written_off'] / df['revenue']",
    },
    {
      category: "Customer / Retail",
      name: "Energy Poverty Flag",
      code: "df['energy_poor'] = (df['energy_spend'] / df['income'] > 0.1).astype(int)",
    },
    {
      category: "Customer / Retail",
      name: "Green Tariff Uptake",
      code: "df['green_uptake'] = df['green_tariff_customers'] / df['total_customers']",
    },
    {
      category: "Customer / Retail",
      name: "Estimated vs Actual Reads",
      code: "df['est_read_pct'] = df['estimated_reads'] / df['total_reads']",
    },
    {
      category: "Customer / Retail",
      name: "Consumption per Household",
      code: "df['kwh_hh'] = df['total_kwh'] / df['households']",
    },
    {
      category: "Customer / Retail",
      name: "Revenue Leakage Rate",
      code: "df['rev_leak'] = df['unbilled_kwh'] * df['avg_unit_rate']",
    },
    {
      category: "Environmental & ESG",
      name: "Scope 1 Emissions",
      code: "df['scope1'] = df['fuel_consumed'] * df['ef_tco2_per_unit']",
    },
    {
      category: "Environmental & ESG",
      name: "Scope 2 Emissions",
      code: "df['scope2'] = df['electricity_kwh'] * df['grid_ef_kg_co2_kwh'] / 1000",
    },
    {
      category: "Environmental & ESG",
      name: "Carbon Intensity (kg/MWh)",
      code: "df['ci'] = df['co2_tonnes'] * 1000 / df['gen_mwh']",
    },
    {
      category: "Environmental & ESG",
      name: "Water Withdrawal Intensity",
      code: "df['water_intensity'] = df['water_m3'] / df['gen_mwh']",
    },
    {
      category: "Environmental & ESG",
      name: "NOx Emission Rate",
      code: "df['nox_rate'] = df['nox_kg'] / df['gen_mwh']",
    },
    {
      category: "Environmental & ESG",
      name: "SOx Emission Rate",
      code: "df['sox_rate'] = df['sox_kg'] / df['gen_mwh']",
    },
    {
      category: "Environmental & ESG",
      name: "Environmental Compliance %",
      code: "df['env_comp'] = df['days_in_compliance'] / df['total_days']",
    },
    {
      category: "Environmental & ESG",
      name: "Carbon Price Exposure",
      code: "df['cp_exposure'] = df['emissions_tonnes'] * df['carbon_price_eur']",
    },
    {
      category: "Environmental & ESG",
      name: "RE100 Progress",
      code: "df['re100_prog'] = df['renewable_electricity_pct']",
    },
    {
      category: "Environmental & ESG",
      name: "Waste to Landfill Rate",
      code: "df['landfill_rate'] = df['waste_landfill_kg'] / df['total_waste_kg']",
    },
  ],
  AGRICULTURE: [
    {
      category: "Crop Production",
      name: "Crop Yield (t/ha)",
      code: "df['yield_ton_ha'] = df['production_tonnes'] / df['area_ha']",
    },
    {
      category: "Crop Production",
      name: "Yield Gap",
      code: "df['yield_gap'] = df['potential_yield'] - df['actual_yield']",
    },
    {
      category: "Crop Production",
      name: "Yield Index",
      code: "df['yield_idx'] = df['yield'] / df['benchmark_yield']",
    },
    {
      category: "Crop Production",
      name: "Crop Intensity",
      code: "df['crop_intensity'] = df['gross_cropped_area'] / df['net_sown_area']",
    },
    {
      category: "Crop Production",
      name: "Harvest Index",
      code: "df['harvest_idx'] = df['grain_weight'] / df['total_biomass']",
    },
    {
      category: "Crop Production",
      name: "Sowing to Harvest Days",
      code: "df['days_to_harvest'] = (df['harvest_date'] - df['sowing_date']).dt.days",
    },
    {
      category: "Crop Production",
      name: "Crop Loss %",
      code: "df['crop_loss'] = (df['expected_yield'] - df['actual_yield']) / df['expected_yield']",
    },
    {
      category: "Crop Production",
      name: "Post-Harvest Loss %",
      code: "df['phl'] = df['post_harvest_loss_kg'] / df['harvested_kg']",
    },
    {
      category: "Crop Production",
      name: "Cropping Pattern % Area",
      code: "df.groupby('crop_type')['area_ha'].sum() / df['area_ha'].sum()",
    },
    {
      category: "Crop Production",
      name: "Land Use Efficiency",
      code: "df['lue'] = df['revenue'] / df['area_ha']",
    },
    {
      category: "Crop Production",
      name: "NDVI (Vegetation Index)",
      code: "df['ndvi'] = (df['nir'] - df['red']) / (df['nir'] + df['red'])",
    },
    {
      category: "Crop Production",
      name: "EVI (Enhanced Vegetation)",
      code: "df['evi'] = 2.5 * (df['nir']-df['red']) / (df['nir']+6*df['red']-7.5*df['blue']+1)",
    },
    {
      category: "Crop Production",
      name: "Stand Count Ratio",
      code: "df['stand_count'] = df['emerged_plants'] / df['seeds_planted']",
    },
    {
      category: "Crop Production",
      name: "Days After Planting",
      code: "df['dap'] = (pd.Timestamp.today() - pd.to_datetime(df['plant_date'])).dt.days",
    },
    {
      category: "Crop Production",
      name: "Growing Degree Days",
      code: "df['gdd'] = ((df['temp_max'] + df['temp_min']) / 2 - df['base_temp']).clip(lower=0).cumsum()",
    },
    {
      category: "Crop Production",
      name: "Heat Units Accumulated",
      code: "df['heat_units'] = df['gdd'].cumsum()",
    },
    {
      category: "Crop Production",
      name: "Chill Hours",
      code: "df['chill_hrs'] = (df['temp_c'].between(0,7)).astype(int).rolling(24).sum()",
    },
    {
      category: "Crop Production",
      name: "Phenological Stage",
      code: "df['pheno'] = pd.cut(df['gdd'], bins=[0,200,500,900,1200], labels=['germination','veg','flowering','grain_fill'])",
    },
    {
      category: "Crop Production",
      name: "Seed Germination Rate",
      code: "df['germ_rate'] = df['germinated'] / df['seeds_planted']",
    },
    {
      category: "Crop Production",
      name: "Tiller Count per Plant",
      code: "df['tillers'] = df['total_tillers'] / df['plant_count']",
    },
    {
      category: "Crop Production",
      name: "Leaf Area Index",
      code: "df['lai'] = df['leaf_area_m2'] / df['ground_area_m2']",
    },
    {
      category: "Crop Production",
      name: "Biomass Accumulation Rate",
      code: "df['biomass_rate'] = df['biomass_kg_ha'].diff() / df['dap'].diff()",
    },
    {
      category: "Crop Production",
      name: "Crop Water Productivity",
      code: "df['cwp'] = df['yield_kg_ha'] / df['water_applied_mm']",
    },
    {
      category: "Crop Production",
      name: "Radiation Use Efficiency",
      code: "df['rue'] = df['biomass_g_m2'] / df['par_mj_m2']",
    },
    {
      category: "Crop Production",
      name: "Net Primary Productivity",
      code: "df['npp'] = df['gross_pp'] - df['respiration']",
    },
    {
      category: "Soil & Nutrient",
      name: "Soil Organic Matter %",
      code: "df['som'] = df['organic_carbon_pct'] * 1.724",
    },
    {
      category: "Soil & Nutrient",
      name: "Soil pH Category",
      code: "df['ph_cat'] = pd.cut(df['soil_ph'], bins=[0,5.5,6.5,7.5,14], labels=['acidic','slightly_acidic','neutral','alkaline'])",
    },
    {
      category: "Soil & Nutrient",
      name: "CEC (Cation Exchange Capacity)",
      code: "df['cec'] = df['ca']+df['mg']+df['k']+df['na']+df['h']",
    },
    {
      category: "Soil & Nutrient",
      name: "Base Saturation %",
      code: "df['base_sat'] = (df['ca']+df['mg']+df['k']+df['na']) / df['cec'] * 100",
    },
    {
      category: "Soil & Nutrient",
      name: "Nitrogen Use Efficiency",
      code: "df['nue'] = df['yield_kg'] / df['n_applied_kg']",
    },
    {
      category: "Soil & Nutrient",
      name: "Phosphorus Use Efficiency",
      code: "df['pue'] = df['yield_kg'] / df['p_applied_kg']",
    },
    {
      category: "Soil & Nutrient",
      name: "K/Mg Ratio",
      code: "df['k_mg'] = df['k_ppm'] / df['mg_ppm']",
    },
    {
      category: "Soil & Nutrient",
      name: "Ca/Mg Ratio",
      code: "df['ca_mg'] = df['ca_ppm'] / df['mg_ppm']",
    },
    {
      category: "Soil & Nutrient",
      name: "Soil Moisture Content",
      code: "df['smc'] = (df['wet_weight'] - df['dry_weight']) / df['dry_weight']",
    },
    {
      category: "Soil & Nutrient",
      name: "Available Water Capacity",
      code: "df['awc'] = df['field_capacity'] - df['wilting_point']",
    },
    {
      category: "Soil & Nutrient",
      name: "Soil Compaction Index",
      code: "df['compact'] = df['bulk_density'] / df['particle_density']",
    },
    {
      category: "Soil & Nutrient",
      name: "Electrical Conductivity Flag",
      code: "df['ec_flag'] = (df['ec_ds_m'] > 4).astype(int)",
    },
    {
      category: "Soil & Nutrient",
      name: "Organic Carbon Sequestration",
      code: "df['c_seq'] = df['som_current'] - df['som_baseline']",
    },
    {
      category: "Soil & Nutrient",
      name: "Soil Health Score",
      code: "df['soil_health'] = df[['som','cec','ph_score','microbial_biomass']].mean(axis=1)",
    },
    {
      category: "Soil & Nutrient",
      name: "N Leaching Risk",
      code: "df['n_leach_risk'] = df['n_surplus'] / df['drainage_mm']",
    },
    {
      category: "Irrigation & Water",
      name: "Irrigation Water Applied (mm)",
      code: "df['irr_mm'] = df['volume_m3'] / (df['area_ha'] * 10)",
    },
    {
      category: "Irrigation & Water",
      name: "Irrigation Efficiency",
      code: "df['irr_eff'] = df['crop_water_uptake'] / df['water_applied']",
    },
    {
      category: "Irrigation & Water",
      name: "Evapotranspiration (ETo)",
      code: "# use pyeto library or Penman-Monteith formula",
    },
    {
      category: "Irrigation & Water",
      name: "Crop Water Stress Index",
      code: "df['cwsi'] = (df['canopy_temp'] - df['wet_bulb_temp']) / (df['dry_temp'] - df['wet_bulb_temp'])",
    },
    {
      category: "Irrigation & Water",
      name: "Soil Water Deficit",
      code: "df['swd'] = df['field_capacity'] - df['current_moisture']",
    },
    {
      category: "Irrigation & Water",
      name: "Reference ET (Hargreaves)",
      code: "df['eto'] = 0.0023 * (df['tmean']+17.8) * (df['tmax']-df['tmin'])**0.5 * df['ra']",
    },
    {
      category: "Irrigation & Water",
      name: "Crop Coefficient (Kc)",
      code: "df['kc'] = df['etc'] / df['eto']",
    },
    {
      category: "Irrigation & Water",
      name: "Actual Crop ET",
      code: "df['etcrop'] = df['kc'] * df['eto']",
    },
    {
      category: "Irrigation & Water",
      name: "Deficit Irrigation Ratio",
      code: "df['deficit_ratio'] = df['applied_water'] / df['full_irr_requirement']",
    },
    {
      category: "Irrigation & Water",
      name: "Water Productivity (kg/m3)",
      code: "df['wp'] = df['yield_kg'] / df['total_water_m3']",
    },
    {
      category: "Irrigation & Water",
      name: "Drip vs Flood Area",
      code: "df['drip_share'] = df[df['irr_type']=='drip']['area_ha'].sum() / df['area_ha'].sum()",
    },
    {
      category: "Irrigation & Water",
      name: "Aquifer Drawdown Rate",
      code: "df['drawdown'] = df['water_level'].diff()",
    },
    {
      category: "Irrigation & Water",
      name: "Rainfall Adequacy",
      code: "df['rain_adequacy'] = df['rainfall_mm'] / df['etcrop']",
    },
    {
      category: "Irrigation & Water",
      name: "Irrigation Scheduling Index",
      code: "df['irr_sched'] = df['current_depletion'] / df['mad_threshold']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Fertilizer Use Rate (kg/ha)",
      code: "df['fert_rate'] = df['fert_kg'] / df['area_ha']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "N Applied per Tonne Yield",
      code: "df['n_per_t'] = df['n_kg_ha'] / df['yield_ton_ha']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Input Cost per Hectare",
      code: "df['input_cost_ha'] = df['total_input_cost'] / df['area_ha']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Return on Fertilizer Investment",
      code: "df['rofi'] = (df['yield_with_fert'] - df['yield_no_fert']) * df['crop_price'] / df['fert_cost']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Pesticide Use Intensity",
      code: "df['pest_intensity'] = df['pesticide_kg'] / df['area_ha']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Agrochemical Cost Share",
      code: "df['chem_share'] = df['agrochem_cost'] / df['total_input_cost']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Seed Cost per Hectare",
      code: "df['seed_cost_ha'] = df['seed_cost'] / df['area_ha']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Variable Cost per Tonne",
      code: "df['vc_t'] = df['variable_cost'] / df['yield_tonnes']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Nutrient Balance",
      code: "df['n_balance'] = df['n_applied'] - df['n_removed_crop'] - df['n_leached']",
    },
    {
      category: "Fertilizer & Inputs",
      name: "Organic vs Synthetic Ratio",
      code: "df['org_ratio'] = df['organic_fert_kg'] / df['total_fert_kg']",
    },
    {
      category: "Livestock",
      name: "Average Daily Gain (ADG)",
      code: "df['adg'] = (df['final_weight'] - df['initial_weight']) / df['days_on_feed']",
    },
    {
      category: "Livestock",
      name: "Feed Conversion Ratio",
      code: "df['fcr'] = df['feed_consumed_kg'] / df['weight_gain_kg']",
    },
    {
      category: "Livestock",
      name: "Feed Efficiency",
      code: "df['fe'] = df['weight_gain_kg'] / df['feed_consumed_kg']",
    },
    {
      category: "Livestock",
      name: "Milk Production per Cow",
      code: "df['milk_yield'] = df['total_milk_litres'] / df['milking_cows']",
    },
    {
      category: "Livestock",
      name: "Somatic Cell Count Flag",
      code: "df['mastitis_risk'] = (df['scc'] > 200000).astype(int)",
    },
    {
      category: "Livestock",
      name: "Conception Rate",
      code: "df['conception'] = df['pregnancies_confirmed'] / df['services']",
    },
    {
      category: "Livestock",
      name: "Calving Interval",
      code: "df['calving_interval'] = (df['next_calving'] - df['prev_calving']).dt.days",
    },
    {
      category: "Livestock",
      name: "Mortality Rate",
      code: "df['mortality'] = df['deaths'] / df['herd_size']",
    },
    {
      category: "Livestock",
      name: "Carcass Yield %",
      code: "df['carcass_yield'] = df['carcass_weight'] / df['live_weight']",
    },
    {
      category: "Livestock",
      name: "Stocking Rate",
      code: "df['stocking_rate'] = df['livestock_units'] / df['pasture_ha']",
    },
    {
      category: "Livestock",
      name: "Carrying Capacity",
      code: "df['carry_cap'] = df['available_forage_kg'] / df['daily_intake_kg']",
    },
    {
      category: "Livestock",
      name: "Egg Production Rate (poultry)",
      code: "df['hen_day_prod'] = df['eggs'] / df['hens'] * 100",
    },
    {
      category: "Livestock",
      name: "Culling Rate",
      code: "df['cull_rate'] = df['culled'] / df['herd_size']",
    },
    {
      category: "Livestock",
      name: "Days in Milk",
      code: "df['dim'] = (df['today'] - df['calving_date']).dt.days",
    },
    {
      category: "Livestock",
      name: "Body Condition Score Change",
      code: "df['bcs_change'] = df['bcs_current'] - df['bcs_prev']",
    },
    {
      category: "Farm Economics",
      name: "Gross Margin per Hectare",
      code: "df['gm_ha'] = (df['yield_ton_ha'] * df['price_per_tonne']) - df['variable_cost_ha']",
    },
    {
      category: "Farm Economics",
      name: "Net Farm Income",
      code: "df['nfi'] = df['total_revenue'] - df['total_cost'] - df['depreciation']",
    },
    {
      category: "Farm Economics",
      name: "Return on Assets",
      code: "df['roa'] = df['nfi'] / df['total_assets']",
    },
    {
      category: "Farm Economics",
      name: "Farm Debt-to-Asset Ratio",
      code: "df['da_ratio'] = df['total_debt'] / df['total_assets']",
    },
    {
      category: "Farm Economics",
      name: "Operating Expense Ratio",
      code: "df['oer'] = df['operating_expenses'] / df['gross_revenue']",
    },
    {
      category: "Farm Economics",
      name: "Break-Even Yield",
      code: "df['be_yield'] = df['total_cost_ha'] / df['crop_price']",
    },
    {
      category: "Farm Economics",
      name: "Break-Even Price",
      code: "df['be_price'] = df['total_cost_ha'] / df['yield_ton_ha']",
    },
    {
      category: "Farm Economics",
      name: "Farm Gate Price Index",
      code: "df['fgp_idx'] = df['farm_gate_price'] / df['market_price']",
    },
    {
      category: "Farm Economics",
      name: "Revenue per Labour Hour",
      code: "df['rev_labour'] = df['revenue'] / df['labour_hours']",
    },
    {
      category: "Farm Economics",
      name: "Machinery Cost per Hectare",
      code: "df['mach_ha'] = df['machinery_cost'] / df['area_ha']",
    },
    {
      category: "Farm Economics",
      name: "Subsidy Dependency Ratio",
      code: "df['subsidy_dep'] = df['subsidy_income'] / df['total_income']",
    },
    {
      category: "Farm Economics",
      name: "Working Capital Ratio",
      code: "df['wc_ratio'] = df['current_assets'] / df['current_liabilities']",
    },
    {
      category: "Farm Economics",
      name: "Commodity Price Risk Score",
      code: "df['price_risk'] = df['price_volatility'] * df['unhedged_volume']",
    },
    {
      category: "Farm Economics",
      name: "Cost of Production per Unit",
      code: "df['cop'] = df['total_cost'] / df['units_produced']",
    },
    {
      category: "Farm Economics",
      name: "Margin over Feed Cost",
      code: "df['mofc'] = df['milk_revenue_per_cow'] - df['feed_cost_per_cow']",
    },
    {
      category: "Weather & Climate",
      name: "Rainfall Cumulative",
      code: "df['rain_cum'] = df['rainfall_mm'].cumsum()",
    },
    {
      category: "Weather & Climate",
      name: "Drought Index (SPI proxy)",
      code: "df['spi'] = (df['rainfall_mm'] - df['rainfall_mm'].rolling(30).mean()) / df['rainfall_mm'].rolling(30).std()",
    },
    {
      category: "Weather & Climate",
      name: "Frost Day Flag",
      code: "df['frost'] = (df['min_temp_c'] < 0).astype(int)",
    },
    {
      category: "Weather & Climate",
      name: "Extreme Heat Flag",
      code: "df['heat_stress'] = (df['max_temp_c'] > 35).astype(int)",
    },
    {
      category: "Weather & Climate",
      name: "Rainfall Anomaly",
      code: "df['rain_anom'] = df['rainfall_mm'] - df.groupby(df['date'].dt.month)['rainfall_mm'].transform('mean')",
    },
    {
      category: "Weather & Climate",
      name: "Wind Speed Daily Avg",
      code: "df['wind_avg'] = df['wind_speed_ms'].rolling(24).mean()",
    },
    {
      category: "Weather & Climate",
      name: "Vapour Pressure Deficit",
      code: "df['vpd'] = df['saturation_vp'] - df['actual_vp']",
    },
    {
      category: "Weather & Climate",
      name: "Growing Season Length",
      code: "df['gsl'] = (df['temp_c'] > 5).astype(int).rolling(7).sum().gt(5).sum()",
    },
    {
      category: "Weather & Climate",
      name: "Hailstorm Risk Days",
      code: "df['hail_risk'] = ((df['convective_index'] > 3) & (df['wind_shear'] > 10)).astype(int)",
    },
    {
      category: "Weather & Climate",
      name: "Soil Temperature at 10cm",
      code: "df['soil_temp_ma'] = df['soil_temp_10cm'].rolling(7).mean()",
    },
    {
      category: "Weather & Climate",
      name: "Photoperiod (daylight hours)",
      code: "# use pvlib or astral library for precise calculation",
    },
    {
      category: "Weather & Climate",
      name: "Dry Spell Days",
      code: "df['dry_spell'] = (df['rainfall_mm'] < 1).astype(int)",
    },
    {
      category: "Weather & Climate",
      name: "Consecutive Dry Days",
      code: "df['cdd'] = df['dry_spell'].groupby((df['dry_spell'].diff()!=0).cumsum()).cumcount()+1",
    },
    {
      category: "Weather & Climate",
      name: "Temperature Range",
      code: "df['temp_range'] = df['max_temp_c'] - df['min_temp_c']",
    },
    {
      category: "Remote Sensing",
      name: "NDWI (Water Index)",
      code: "df['ndwi'] = (df['green'] - df['nir']) / (df['green'] + df['nir'])",
    },
    {
      category: "Remote Sensing",
      name: "NDRE (Red Edge)",
      code: "df['ndre'] = (df['nir'] - df['red_edge']) / (df['nir'] + df['red_edge'])",
    },
    {
      category: "Remote Sensing",
      name: "SAVI (Soil-Adjusted VI)",
      code: "L=0.5; df['savi'] = (df['nir']-df['red']) * (1+L) / (df['nir']+df['red']+L)",
    },
    {
      category: "Remote Sensing",
      name: "LAI from NDVI",
      code: "df['lai_ndvi'] = -np.log((0.69 - df['ndvi']) / 0.59) / 0.91",
    },
    {
      category: "Remote Sensing",
      name: "Canopy Cover %",
      code: "df['canopy'] = (df['ndvi'] > 0.3).mean() * 100",
    },
    {
      category: "Remote Sensing",
      name: "Crop Stress Zone Flag",
      code: "df['stress'] = (df['ndvi'] < df['ndvi'].quantile(0.2)).astype(int)",
    },
    {
      category: "Remote Sensing",
      name: "Yield Prediction (RF proxy)",
      code: "# sklearn RandomForestRegressor trained on ndvi_history + weather_features",
    },
    {
      category: "Remote Sensing",
      name: "Management Zone Classification",
      code: "from sklearn.cluster import KMeans; df['zone']=KMeans(n_clusters=3).fit_predict(df[['ndvi','ec','elevation']])",
    },
    {
      category: "Remote Sensing",
      name: "Variable Rate Application Score",
      code: "df['vra'] = df['nutrient_deficiency'] * df['yield_potential']",
    },
    {
      category: "Remote Sensing",
      name: "Field Uniformity Index",
      code: "df['uniformity'] = 1 - df.groupby('field_id')['ndvi'].transform('std') / df.groupby('field_id')['ndvi'].transform('mean')",
    },
  ],
  TRANSPORTATION: [
    {
      category: "Transit / Passenger",
      name: "On-Time Performance",
      code: "df['otp'] = (df['actual_arrival'] <= df['scheduled_arrival'] + pd.Timedelta('5min')).mean()",
    },
    {
      category: "Transit / Passenger",
      name: "Average Delay",
      code: "df['avg_delay'] = (df['actual_arrival'] - df['scheduled_arrival']).dt.total_seconds().clip(lower=0) / 60",
    },
    {
      category: "Transit / Passenger",
      name: "Headway Adherence",
      code: "df['headway_dev'] = abs(df['actual_headway'] - df['scheduled_headway']) / df['scheduled_headway']",
    },
    {
      category: "Transit / Passenger",
      name: "Passenger Load Factor",
      code: "df['load_factor'] = df['passengers'] / df['capacity']",
    },
    {
      category: "Transit / Passenger",
      name: "Revenue Passenger Miles",
      code: "df['rpm'] = df['paying_passengers'] * df['miles']",
    },
    {
      category: "Transit / Passenger",
      name: "Available Seat Miles",
      code: "df['asm'] = df['seats'] * df['miles']",
    },
    {
      category: "Transit / Passenger",
      name: "Passenger Load % (ASM)",
      code: "df['plf'] = df['rpm'] / df['asm']",
    },
    {
      category: "Transit / Passenger",
      name: "Revenue per Passenger Mile",
      code: "df['yield'] = df['passenger_revenue'] / df['rpm']",
    },
    {
      category: "Transit / Passenger",
      name: "Cost per Passenger Mile",
      code: "df['casm'] = df['operating_cost'] / df['asm']",
    },
    {
      category: "Transit / Passenger",
      name: "Passenger Revenue per KM",
      code: "df['prpkm'] = df['revenue'] / df['passenger_km']",
    },
    {
      category: "Transit / Passenger",
      name: "Seat Occupancy Rate",
      code: "df['occ_rate'] = df['passengers'] / df['seats']",
    },
    {
      category: "Transit / Passenger",
      name: "Boarding Rate per Stop",
      code: "df['board_rate'] = df['boardings'] / df['stop_count']",
    },
    {
      category: "Transit / Passenger",
      name: "Interchange Rate",
      code: "df['interchange'] = df['transfers'] / df['journeys']",
    },
    {
      category: "Transit / Passenger",
      name: "Journey Time Reliability (JTR)",
      code: "df['jtr'] = df.groupby('route')['travel_time'].transform(lambda x: (x <= x.quantile(0.95)).mean())",
    },
    {
      category: "Transit / Passenger",
      name: "No-Show Rate",
      code: "df['no_show'] = df['no_shows'] / df['bookings']",
    },
    {
      category: "Transit / Passenger",
      name: "Cancellation Rate",
      code: "df['cancel_rate'] = df['cancelled_services'] / df['planned_services']",
    },
    {
      category: "Transit / Passenger",
      name: "Revenue per Vehicle km",
      code: "df['rpvkm'] = df['revenue'] / df['vehicle_km']",
    },
    {
      category: "Transit / Passenger",
      name: "Cost per Vehicle km",
      code: "df['cpvkm'] = df['cost'] / df['vehicle_km']",
    },
    {
      category: "Transit / Passenger",
      name: "Ridership Growth YoY",
      code: "df['ridership_growth'] = df['passengers'].pct_change(12)",
    },
    {
      category: "Transit / Passenger",
      name: "Peak to Off-Peak Ratio",
      code: "df['pk_ratio'] = df[df['peak']==1]['passengers'].mean() / df[df['peak']==0]['passengers'].mean()",
    },
    {
      category: "Transit / Passenger",
      name: "Ticket Revenue per Passenger",
      code: "df['trpp'] = df['ticket_revenue'] / df['passengers']",
    },
    {
      category: "Transit / Passenger",
      name: "Ancillary Revenue Share",
      code: "df['ancillary_share'] = df['ancillary_revenue'] / df['total_revenue']",
    },
    {
      category: "Transit / Passenger",
      name: "Average Trip Length",
      code: "df['atl'] = df['total_km'] / df['trips']",
    },
    {
      category: "Aviation",
      name: "Flight On-Time Departure",
      code: "df['otd'] = (df['actual_dep'] <= df['sched_dep'] + pd.Timedelta('15min')).mean()",
    },
    {
      category: "Aviation",
      name: "Flight On-Time Arrival",
      code: "df['ota'] = (df['actual_arr'] <= df['sched_arr'] + pd.Timedelta('15min')).mean()",
    },
    {
      category: "Aviation",
      name: "Departure Delay Min",
      code: "df['dep_delay'] = (df['actual_dep'] - df['sched_dep']).dt.total_seconds().clip(lower=0) / 60",
    },
    {
      category: "Aviation",
      name: "CASK (Cost per ASK)",
      code: "df['cask'] = df['operating_cost'] / df['ask']",
    },
    {
      category: "Aviation",
      name: "RASK (Revenue per ASK)",
      code: "df['rask'] = df['total_revenue'] / df['ask']",
    },
    {
      category: "Aviation",
      name: "Yield (Revenue per RPK)",
      code: "df['yield'] = df['pax_revenue'] / df['rpk']",
    },
    {
      category: "Aviation",
      name: "Fuel Cost per ASK",
      code: "df['fuel_ask'] = df['fuel_cost'] / df['ask']",
    },
    {
      category: "Aviation",
      name: "Block Hours Utilization",
      code: "df['block_util'] = df['block_hours'] / df['aircraft_days'] / 24",
    },
    {
      category: "Aviation",
      name: "Aircraft Turnaround Time",
      code: "df['tat'] = (df['next_dep'] - df['arr']).dt.total_seconds() / 60",
    },
    {
      category: "Aviation",
      name: "Technical Dispatch Reliability",
      code: "df['tdr'] = (df['delays_tech']==0).mean()",
    },
    {
      category: "Aviation",
      name: "Revenue per Block Hour",
      code: "df['rpbh'] = df['revenue'] / df['block_hours']",
    },
    {
      category: "Aviation",
      name: "Load Factor (PLF)",
      code: "df['plf'] = df['rpk'] / df['ask']",
    },
    {
      category: "Aviation",
      name: "Cargo Load Factor",
      code: "df['clf'] = df['rtk'] / df['atk']",
    },
    {
      category: "Aviation",
      name: "Fuel Consumption per 100 ASK",
      code: "df['fuel_eff'] = df['fuel_kg'] / df['ask'] * 100",
    },
    {
      category: "Aviation",
      name: "CO2 per RPK",
      code: "df['co2_rpk'] = df['co2_kg'] / df['rpk']",
    },
    {
      category: "Aviation",
      name: "Cancellation Rate",
      code: "df['cancel'] = df['cancelled'] / df['scheduled']",
    },
    {
      category: "Aviation",
      name: "Completion Factor",
      code: "df['completion'] = 1 - df['cancel']",
    },
    {
      category: "Aviation",
      name: "Seat Revenue (Ancillary)",
      code: "df['seat_rev'] = df['seat_upsells'] / df['pax']",
    },
    {
      category: "Aviation",
      name: "EBITDAR Margin",
      code: "df['ebitdar_margin'] = df['ebitdar'] / df['revenue']",
    },
    {
      category: "Aviation",
      name: "Cost per Available Seat",
      code: "df['cpas'] = df['cost'] / df['available_seats']",
    },
    {
      category: "Road / Highway",
      name: "Traffic Volume (AADT)",
      code: "df['aadt'] = df['annual_vehicles'] / 365",
    },
    {
      category: "Road / Highway",
      name: "Traffic Volume Index",
      code: "df['tvi'] = df['vehicle_count'] / df['baseline_count']",
    },
    {
      category: "Road / Highway",
      name: "Peak Hour Factor",
      code: "df['phf'] = df['peak_hour_volume'] / (df['peak_15min_volume'] * 4)",
    },
    {
      category: "Road / Highway",
      name: "V/C Ratio (Level of Service)",
      code: "df['vc_ratio'] = df['volume'] / df['capacity']",
    },
    {
      category: "Road / Highway",
      name: "LOS Classification",
      code: "df['los'] = pd.cut(df['vc_ratio'], bins=[0,0.6,0.7,0.8,0.9,1.0,99], labels=['A','B','C','D','E','F'])",
    },
    {
      category: "Road / Highway",
      name: "Average Speed",
      code: "df['avg_speed'] = df['distance_km'] / df['travel_time_hr']",
    },
    {
      category: "Road / Highway",
      name: "Speed Compliance Rate",
      code: "df['speed_comp'] = (df['speed_kmh'] <= df['speed_limit']).mean()",
    },
    {
      category: "Road / Highway",
      name: "Travel Time Index",
      code: "df['tti'] = df['peak_travel_time'] / df['free_flow_time']",
    },
    {
      category: "Road / Highway",
      name: "Buffer Time Index",
      code: "df['bti'] = (df['tt_95th'] - df['tt_50th']) / df['tt_50th']",
    },
    {
      category: "Road / Highway",
      name: "Accident Rate per MVMT",
      code: "df['accident_rate'] = df['accidents'] / (df['aadt'] * df['segment_km'] * 365) * 1e6",
    },
    {
      category: "Road / Highway",
      name: "Fatality Rate",
      code: "df['fatality_rate'] = df['fatalities'] / df['vmkt'] * 1e9",
    },
    {
      category: "Road / Highway",
      name: "Pavement Condition Index",
      code: "df['pci'] = 100 - df['roughness_score'] * df['distress_weight']",
    },
    {
      category: "Road / Highway",
      name: "IRI (International Roughness Index)",
      code: "df['iri_class'] = pd.cut(df['iri'], bins=[0,2,4,8,16,99], labels=['good','acceptable','poor','bad','very_bad'])",
    },
    {
      category: "Road / Highway",
      name: "Toll Revenue per Vehicle",
      code: "df['toll_rpv'] = df['toll_revenue'] / df['toll_transactions']",
    },
    {
      category: "Road / Highway",
      name: "E-tag Adoption Rate",
      code: "df['etag_rate'] = df['electronic_txn'] / df['total_txn']",
    },
    {
      category: "Road / Highway",
      name: "Carbon Emissions per km (road)",
      code: "df['road_co2'] = df['fuel_litres'] * 2.31 / df['km']",
    },
    {
      category: "Rail",
      name: "Train km Operated",
      code: "df['train_km'] = df['trains_operated'] * df['route_km']",
    },
    {
      category: "Rail",
      name: "Seat km Available",
      code: "df['seat_km'] = df['seats'] * df['distance_km']",
    },
    {
      category: "Rail",
      name: "Gross Tonne km",
      code: "df['gtk'] = df['gross_weight_t'] * df['distance_km']",
    },
    {
      category: "Rail",
      name: "Net Tonne km",
      code: "df['ntk'] = df['cargo_weight_t'] * df['distance_km']",
    },
    {
      category: "Rail",
      name: "Wagon Turnaround Days",
      code: "df['wagon_ta'] = df['total_wagon_days'] / df['wagon_count']",
    },
    {
      category: "Rail",
      name: "Locomotive Availability",
      code: "df['loco_avail'] = df['available_locos'] / df['total_locos']",
    },
    {
      category: "Rail",
      name: "Track Occupancy Rate",
      code: "df['track_occ'] = df['occupied_mins'] / df['total_mins']",
    },
    {
      category: "Rail",
      name: "Freight Revenue per NTK",
      code: "df['frt_rev_ntk'] = df['freight_revenue'] / df['ntk']",
    },
    {
      category: "Rail",
      name: "Cost per Train km",
      code: "df['cptk'] = df['cost'] / df['train_km']",
    },
    {
      category: "Rail",
      name: "Station Dwell Time",
      code: "df['dwell'] = (df['depart_time'] - df['arrive_time']).dt.total_seconds() / 60",
    },
    {
      category: "Rail",
      name: "Signal Failure Rate",
      code: "df['sig_fail'] = df['signal_failures'] / df['train_km'] * 1000",
    },
    {
      category: "Rail",
      name: "Track Quality Number",
      code: "df['tqn'] = df['track_geometry_score'].mean()",
    },
    {
      category: "Rail",
      name: "Safety Events per million km",
      code: "df['safety_rate'] = df['safety_events'] / df['train_km'] * 1e6",
    },
    {
      category: "Rail",
      name: "Energy per Gross Tonne km",
      code: "df['energy_gtk'] = df['kwh'] / df['gtk']",
    },
    {
      category: "Urban Mobility",
      name: "Trips per Capita",
      code: "df['trips_pc'] = df['total_trips'] / df['population']",
    },
    {
      category: "Urban Mobility",
      name: "Mode Share",
      code: "df.groupby('mode')['trips'].sum() / df['trips'].sum()",
    },
    {
      category: "Urban Mobility",
      name: "Active Mode Share",
      code: "df['active_share'] = df[df['mode'].isin(['walk','cycle'])]['trips'].sum() / df['trips'].sum()",
    },
    {
      category: "Urban Mobility",
      name: "Public Transit Share",
      code: "df['pt_share'] = df[df['mode'].isin(['bus','rail','metro'])]['trips'].sum() / df['trips'].sum()",
    },
    {
      category: "Urban Mobility",
      name: "Average Commute Time",
      code: "df['avg_commute'] = df[df['trip_purpose']=='work']['travel_time_min'].mean()",
    },
    {
      category: "Urban Mobility",
      name: "Congestion Cost per Commuter",
      code: "df['cong_cost'] = df['delay_hrs'] * df['hourly_wage']",
    },
    {
      category: "Urban Mobility",
      name: "Ride-Share Pooling Rate",
      code: "df['pool_rate'] = df['pooled_trips'] / df['total_rideshare_trips']",
    },
    {
      category: "Urban Mobility",
      name: "E-scooter Utilization Rate",
      code: "df['scooter_util'] = df['trips_per_scooter'] / df['available_hours'] * 24",
    },
    {
      category: "Urban Mobility",
      name: "First/Last Mile Coverage",
      code: "df['flm_cov'] = df['stops_within_400m'] / df['total_stops']",
    },
    {
      category: "Urban Mobility",
      name: "MaaS Subscription Adoption",
      code: "df['maas_adopt'] = df['maas_users'] / df['total_commuters']",
    },
    {
      category: "Urban Mobility",
      name: "Bike Share Trips per Dock",
      code: "df['bs_utilization'] = df['trips'] / df['docks']",
    },
    {
      category: "Urban Mobility",
      name: "Pedestrian Flow Density",
      code: "df['ped_density'] = df['pedestrians'] / df['footpath_width_m']",
    },
    {
      category: "Urban Mobility",
      name: "Accessibility Score",
      code: "df['access'] = df['jobs_within_30min'] / df['total_jobs']",
    },
    {
      category: "Urban Mobility",
      name: "Network Coverage %",
      code: "df['net_cov'] = df['pop_within_400m_stop'] / df['total_population']",
    },
    {
      category: "Urban Mobility",
      name: "Vehicle km Travelled per Capita",
      code: "df['vkt_pc'] = df['total_vkt'] / df['population']",
    },
    {
      category: "Port / Maritime",
      name: "Berth Occupancy Rate",
      code: "df['berth_occ'] = df['berth_time_hrs'] / df['total_available_hrs']",
    },
    {
      category: "Port / Maritime",
      name: "Crane Productivity (moves/hr)",
      code: "df['crane_prod'] = df['moves'] / df['crane_hours']",
    },
    {
      category: "Port / Maritime",
      name: "Ship Turnaround Time",
      code: "df['tat'] = (df['departure'] - df['arrival']).dt.total_seconds() / 3600",
    },
    {
      category: "Port / Maritime",
      name: "Container Dwell Time",
      code: "df['dwell'] = (df['pickup'] - df['discharge']).dt.days",
    },
    {
      category: "Port / Maritime",
      name: "TEU Throughput per Berth",
      code: "df['teu_berth'] = df['teu'] / df['berths']",
    },
    {
      category: "Port / Maritime",
      name: "Port Efficiency Score",
      code: "df['port_eff'] = df['teu'] / (df['berth_hrs'] * df['crane_count'])",
    },
    {
      category: "Port / Maritime",
      name: "Vessel Waiting Time",
      code: "df['wait_hrs'] = (df['berth_start'] - df['arrival']).dt.total_seconds() / 3600",
    },
    {
      category: "Port / Maritime",
      name: "Deadweight Utilization",
      code: "df['dwt_util'] = df['cargo_tonnes'] / df['dwt']",
    },
    {
      category: "Port / Maritime",
      name: "AIS Position Frequency",
      code: "df['ais_freq'] = df.groupby('vessel_id')['timestamp'].transform('count') / df.groupby('vessel_id')['voyage_days'].transform('max')",
    },
    {
      category: "Port / Maritime",
      name: "Fuel Consumption per NM",
      code: "df['fuel_nm'] = df['fuel_tonnes'] / df['nautical_miles']",
    },
    {
      category: "Port / Maritime",
      name: "EEOI (Energy Efficiency)",
      code: "df['eeoi'] = df['fuel_co2_tonnes'] / (df['cargo_tonnes'] * df['nautical_miles'])",
    },
    {
      category: "Port / Maritime",
      name: "Port State Control Deficiency Rate",
      code: "df['psc_def'] = df['deficiencies'] / df['inspections']",
    },
    {
      category: "Safety & Environment",
      name: "Accident Severity Index",
      code: "df['asi'] = (df['fatalities']*3 + df['serious_injuries']*2 + df['minor_injuries']) / df['accidents']",
    },
    {
      category: "Safety & Environment",
      name: "Near-Miss Reporting Rate",
      code: "df['nm_rate'] = df['near_misses'] / df['total_movements'] * 1e6",
    },
    {
      category: "Safety & Environment",
      name: "Safety Audit Compliance",
      code: "df['audit_comp'] = df['passed_items'] / df['total_items']",
    },
    {
      category: "Safety & Environment",
      name: "Driver Hours Compliance",
      code: "df['hours_comp'] = (df['daily_hrs'] <= 10).mean()",
    },
    {
      category: "Safety & Environment",
      name: "Emissions per Passenger km",
      code: "df['co2_pkm'] = df['co2_kg'] / df['passenger_km']",
    },
    {
      category: "Safety & Environment",
      name: "Noise Level Compliance",
      code: "df['noise_comp'] = (df['db_level'] <= df['threshold']).mean()",
    },
    {
      category: "Safety & Environment",
      name: "Fleet Average Age",
      code: "df['fleet_age'] = (pd.Timestamp.today() - pd.to_datetime(df['manufacture_year'].astype(str))).dt.days / 365",
    },
    {
      category: "Safety & Environment",
      name: "Electric Vehicle Penetration",
      code: "df['ev_pen'] = df[df['fuel_type']=='electric'].shape[0] / df.shape[0]",
    },
    {
      category: "Safety & Environment",
      name: "Carbon Neutral Progress",
      code: "df['carbon_prog'] = 1 - df['current_emissions'] / df['baseline_emissions']",
    },
    {
      category: "Safety & Environment",
      name: "Infrastructure Condition Score",
      code: "df['infra_score'] = df[['pavement','bridges','signals','markings']].mean(axis=1)",
    },
  ],
  REAL_ESTATE: [
    {
      category: "Property Valuation",
      name: "Price per Sq Ft",
      code: "df['ppsf'] = df['sale_price'] / df['sq_ft']",
    },
    {
      category: "Property Valuation",
      name: "Price per Sq Ft vs Neighbourhood Avg",
      code: "df['ppsf_idx'] = df['ppsf'] / df.groupby('neighbourhood')['ppsf'].transform('mean')",
    },
    {
      category: "Property Valuation",
      name: "Assessed Value Ratio",
      code: "df['av_ratio'] = df['assessed_value'] / df['sale_price']",
    },
    {
      category: "Property Valuation",
      name: "Zestimate Error",
      code: "df['zest_err'] = (df['estimate'] - df['sale_price']) / df['sale_price']",
    },
    {
      category: "Property Valuation",
      name: "Cap Rate",
      code: "df['cap_rate'] = df['noi'] / df['property_value']",
    },
    {
      category: "Property Valuation",
      name: "Gross Rent Multiplier",
      code: "df['grm'] = df['sale_price'] / df['annual_gross_rent']",
    },
    {
      category: "Property Valuation",
      name: "Price-to-Rent Ratio",
      code: "df['p2r'] = df['price'] / (df['monthly_rent'] * 12)",
    },
    {
      category: "Property Valuation",
      name: "Hedonic Price Index",
      code: "# OLS regression: price ~ beds + baths + sq_ft + age + location_dummies",
    },
    {
      category: "Property Valuation",
      name: "Repeat Sales Index",
      code: "# Bailey-Muth-Nourse method on paired sales of same property",
    },
    {
      category: "Property Valuation",
      name: "Land Value Share",
      code: "df['land_share'] = df['land_value'] / df['total_value']",
    },
    {
      category: "Property Valuation",
      name: "Improvement Ratio",
      code: "df['impr_ratio'] = df['improvement_value'] / df['land_value']",
    },
    {
      category: "Property Valuation",
      name: "Days on Market",
      code: "df['dom'] = (df['sale_date'] - df['list_date']).dt.days",
    },
    {
      category: "Property Valuation",
      name: "List-to-Sale Price Ratio",
      code: "df['lsp_ratio'] = df['sale_price'] / df['list_price']",
    },
    {
      category: "Property Valuation",
      name: "Price Reduction Flag",
      code: "df['price_reduced'] = (df['list_price_final'] < df['list_price_original']).astype(int)",
    },
    {
      category: "Property Valuation",
      name: "Time on Market Bucket",
      code: "df['dom_bucket'] = pd.cut(df['dom'], bins=[0,7,30,90,365,9999], labels=['<1w','1m','3m','1yr','>1yr'])",
    },
    {
      category: "Investment Returns",
      name: "Net Operating Income",
      code: "df['noi'] = df['gross_rent'] - df['vacancy_loss'] - df['operating_expenses']",
    },
    {
      category: "Investment Returns",
      name: "Cash-on-Cash Return",
      code: "df['coc'] = df['annual_cash_flow'] / df['total_cash_invested']",
    },
    {
      category: "Investment Returns",
      name: "Total Return",
      code: "df['total_ret'] = (df['sale_price'] - df['purchase_price'] + df['rental_income_total']) / df['purchase_price']",
    },
    {
      category: "Investment Returns",
      name: "Equity Multiple",
      code: "df['equity_mult'] = df['total_distributions'] / df['initial_equity']",
    },
    {
      category: "Investment Returns",
      name: "Debt Coverage Ratio",
      code: "df['dscr'] = df['noi'] / df['annual_debt_service']",
    },
    {
      category: "Investment Returns",
      name: "Loan-to-Value Ratio",
      code: "df['ltv'] = df['loan_amount'] / df['appraised_value']",
    },
    {
      category: "Investment Returns",
      name: "Break-Even Occupancy",
      code: "df['be_occ'] = (df['operating_expenses'] + df['debt_service']) / df['gross_potential_rent']",
    },
    {
      category: "Investment Returns",
      name: "Vacancy Rate",
      code: "df['vacancy'] = df['vacant_units'] / df['total_units']",
    },
    {
      category: "Investment Returns",
      name: "Effective Gross Income",
      code: "df['egi'] = df['gross_potential_rent'] * (1 - df['vacancy'])",
    },
    {
      category: "Investment Returns",
      name: "Operating Expense Ratio",
      code: "df['oer'] = df['operating_expenses'] / df['egi']",
    },
    {
      category: "Investment Returns",
      name: "Rental Yield",
      code: "df['rental_yield'] = df['annual_rent'] / df['property_value']",
    },
    {
      category: "Investment Returns",
      name: "Price Appreciation Rate",
      code: "df['appreciation'] = df['current_value'].pct_change(12)",
    },
    {
      category: "Market Conditions",
      name: "Months of Inventory",
      code: "df['months_inv'] = df['active_listings'] / df['monthly_sales']",
    },
    {
      category: "Market Conditions",
      name: "Absorption Rate",
      code: "df['absorption'] = df['units_sold_month'] / df['active_listings']",
    },
    {
      category: "Market Conditions",
      name: "Sale-to-List Ratio",
      code: "df['slr'] = df['avg_sale_price'] / df['avg_list_price']",
    },
    {
      category: "Market Conditions",
      name: "Market Temperature",
      code: "df['mkt_temp'] = pd.cut(df['months_inv'], bins=[0,3,6,9,99], labels=['hot','balanced','cool','cold'])",
    },
    {
      category: "Market Conditions",
      name: "New Listing Growth",
      code: "df['new_list_growth'] = df['new_listings'].pct_change(12)",
    },
    {
      category: "Market Conditions",
      name: "Affordability Index",
      code: "df['affordability'] = df['median_income'] / (df['median_price'] / df['income_needed_ratio'])",
    },
    {
      category: "Market Conditions",
      name: "Homeownership Rate Change",
      code: "df['own_rate_chg'] = df['homeownership_rate'].diff()",
    },
    {
      category: "Market Conditions",
      name: "Permit Activity Index",
      code: "df['permit_idx'] = df['permits'] / df['permits'].rolling(12).mean()",
    },
    {
      category: "Market Conditions",
      name: "Foreclosure Rate",
      code: "df['fc_rate'] = df['foreclosures'] / df['total_homes']",
    },
    {
      category: "Market Conditions",
      name: "Negative Equity %",
      code: "df['neg_equity'] = (df['loan_balance'] > df['current_value']).mean()",
    },
    {
      category: "Property Features",
      name: "Age of Property",
      code: "df['age'] = pd.Timestamp.today().year - df['year_built']",
    },
    {
      category: "Property Features",
      name: "Renovation Indicator",
      code: "df['renovated'] = (df['year_renovated'] > df['year_built']).astype(int)",
    },
    {
      category: "Property Features",
      name: "Years Since Renovation",
      code: "df['yrs_since_reno'] = pd.Timestamp.today().year - df['year_renovated'].fillna(df['year_built'])",
    },
    {
      category: "Property Features",
      name: "Walk Score Category",
      code: "df['walk_cat'] = pd.cut(df['walk_score'], bins=[0,24,49,69,89,100], labels=['car_dep','some_walk','walkable','very_walk','walkers_paradise'])",
    },
    {
      category: "Property Features",
      name: "School District Quality",
      code: "df['school_q'] = df['school_rating'].rank(pct=True)",
    },
    {
      category: "Property Features",
      name: "Flood Zone Flag",
      code: "df['flood_risk'] = df['flood_zone'].isin(['AE','VE','A']).astype(int)",
    },
    {
      category: "Property Features",
      name: "Distance to CBD (km)",
      code: "# haversine(property_coords, cbd_coords)",
    },
    {
      category: "Property Features",
      name: "Lot Size Ratio",
      code: "df['lot_ratio'] = df['lot_sq_ft'] / df['building_sq_ft']",
    },
    {
      category: "Property Features",
      name: "Bedroom-to-Bathroom Ratio",
      code: "df['bed_bath'] = df['beds'] / df['baths']",
    },
  ],
  HUMAN_RESOURCES: [
    {
      category: "Workforce Analytics",
      name: "Headcount by Dept",
      code: "df.groupby('department')['employee_id'].nunique()",
    },
    {
      category: "Workforce Analytics",
      name: "FTE Equivalent",
      code: "df['fte'] = df['hours_per_week'] / 40",
    },
    {
      category: "Workforce Analytics",
      name: "Span of Control",
      code: "df['span'] = df.groupby('manager_id')['employee_id'].transform('count')",
    },
    {
      category: "Workforce Analytics",
      name: "Org Flatness Index",
      code: "df['flatness'] = df['total_employees'] / df['managers']",
    },
    {
      category: "Workforce Analytics",
      name: "Years of Service",
      code: "df['tenure_yrs'] = (pd.Timestamp.today() - pd.to_datetime(df['hire_date'])).dt.days / 365",
    },
    {
      category: "Workforce Analytics",
      name: "Tenure Bucket",
      code: "df['tenure_band'] = pd.cut(df['tenure_yrs'], bins=[0,1,3,5,10,99], labels=['<1yr','1-3yr','3-5yr','5-10yr','10yr+'])",
    },
    {
      category: "Workforce Analytics",
      name: "Age Group",
      code: "df['age_group'] = pd.cut(df['age'], bins=[0,25,35,45,55,99], labels=['Gen-Z','Millennial','Gen-X-young','Gen-X-senior','Boomer'])",
    },
    {
      category: "Workforce Analytics",
      name: "Gender Pay Gap",
      code: "df['gender_gap'] = df.groupby('gender')['salary'].mean().pct_change().iloc[-1]",
    },
    {
      category: "Workforce Analytics",
      name: "Compa-Ratio",
      code: "df['compa_ratio'] = df['actual_salary'] / df['midpoint_salary']",
    },
    {
      category: "Workforce Analytics",
      name: "Salary Range Penetration",
      code: "df['srp'] = (df['salary'] - df['range_min']) / (df['range_max'] - df['range_min'])",
    },
    {
      category: "Attrition / Retention",
      name: "Voluntary Turnover Rate",
      code: "df['vol_turnover'] = df['voluntary_exits'] / df['avg_headcount']",
    },
    {
      category: "Attrition / Retention",
      name: "Involuntary Turnover Rate",
      code: "df['invol_turnover'] = df['involuntary_exits'] / df['avg_headcount']",
    },
    {
      category: "Attrition / Retention",
      name: "Regrettable Attrition Rate",
      code: "df['regrettable'] = df['regrettable_exits'] / df['total_exits']",
    },
    {
      category: "Attrition / Retention",
      name: "First-Year Attrition",
      code: "df['y1_attrition'] = df[df['tenure_yrs'] < 1]['left'].mean()",
    },
    {
      category: "Attrition / Retention",
      name: "90-Day Attrition",
      code: "df['d90_attrition'] = df[df['tenure_days'] < 90]['left'].mean()",
    },
    {
      category: "Attrition / Retention",
      name: "Retention Rate",
      code: "df['retention'] = 1 - df['vol_turnover']",
    },
    {
      category: "Attrition / Retention",
      name: "Flight Risk Score",
      code: "df['flight_risk'] = df[['low_engagement','below_market_pay','low_manager_score','no_promo_3yr']].dot([0.3,0.25,0.25,0.2])",
    },
    {
      category: "Attrition / Retention",
      name: "Cost of Turnover",
      code: "df['turnover_cost'] = df['exits'] * df['salary'] * 0.5  # 50% salary rule of thumb",
    },
    {
      category: "Attrition / Retention",
      name: "Internal Mobility Rate",
      code: "df['mobility_rate'] = df['internal_moves'] / df['avg_headcount']",
    },
    {
      category: "Attrition / Retention",
      name: "Promotion Rate",
      code: "df['promo_rate'] = df['promotions'] / df['eligible_employees']",
    },
    {
      category: "Attrition / Retention",
      name: "Time to Promotion",
      code: "df['ttp'] = df.groupby('employee_id')['promotion_date'].apply(lambda x: x.diff().dt.days.mean())",
    },
    {
      category: "Attrition / Retention",
      name: "Succession Coverage Ratio",
      code: "df['succession_cov'] = df['roles_with_successor'] / df['critical_roles']",
    },
    {
      category: "Recruitment",
      name: "Time to Fill",
      code: "df['ttf'] = (df['offer_accept_date'] - df['req_open_date']).dt.days",
    },
    {
      category: "Recruitment",
      name: "Time to Hire",
      code: "df['tth'] = (df['start_date'] - df['application_date']).dt.days",
    },
    {
      category: "Recruitment",
      name: "Cost per Hire",
      code: "df['cph'] = (df['recruiter_cost'] + df['job_board_spend'] + df['agency_fees']) / df['hires']",
    },
    {
      category: "Recruitment",
      name: "Offer Acceptance Rate",
      code: "df['oar'] = df['offers_accepted'] / df['offers_extended']",
    },
    {
      category: "Recruitment",
      name: "Application to Interview Rate",
      code: "df['a2i'] = df['interviews'] / df['applications']",
    },
    {
      category: "Recruitment",
      name: "Interview to Offer Rate",
      code: "df['i2o'] = df['offers'] / df['interviews']",
    },
    {
      category: "Recruitment",
      name: "Funnel Conversion Rate",
      code: "df['hire_rate'] = df['hires'] / df['applications']",
    },
    {
      category: "Recruitment",
      name: "Source Effectiveness",
      code: "df.groupby('source')['hired'].sum() / df.groupby('source')['applied'].sum()",
    },
    {
      category: "Recruitment",
      name: "Quality of Hire Score",
      code: "df['qoh'] = df['performance_score']*0.5 + df['retention_flag']*0.3 + df['manager_rating']*0.2",
    },
    {
      category: "Recruitment",
      name: "Diversity Hire Rate",
      code: "df['diversity_rate'] = df[df['underrepresented']==1]['hired'].sum() / df['hired'].sum()",
    },
    {
      category: "Recruitment",
      name: "Requisition Backlog",
      code: "df['backlog'] = df['open_reqs'] / df['monthly_fill_rate']",
    },
    {
      category: "Performance & Engagement",
      name: "Performance Rating Distribution",
      code: "df['perf_pct'] = df.groupby('rating')['employee_id'].transform('count') / df['employee_id'].nunique()",
    },
    {
      category: "Performance & Engagement",
      name: "eNPS Score",
      code: "df['enps'] = (df['score']>=9).mean()*100 - (df['score']<=6).mean()*100",
    },
    {
      category: "Performance & Engagement",
      name: "Engagement Score",
      code: "df['engagement'] = df[engagement_cols].mean(axis=1)",
    },
    {
      category: "Performance & Engagement",
      name: "Absenteeism Rate",
      code: "df['absent_rate'] = df['absent_days'] / df['scheduled_days']",
    },
    {
      category: "Performance & Engagement",
      name: "Bradford Factor",
      code: "df['bradford'] = df['absence_instances']**2 * df['total_absent_days']",
    },
    {
      category: "Performance & Engagement",
      name: "Overtime Rate",
      code: "df['ot_rate'] = df['overtime_hours'] / df['scheduled_hours']",
    },
    {
      category: "Performance & Engagement",
      name: "Training Hours per Employee",
      code: "df['training_hrs'] = df['total_training_hrs'] / df['headcount']",
    },
    {
      category: "Performance & Engagement",
      name: "Training Completion Rate",
      code: "df['train_comp'] = df['completed_trainings'] / df['assigned_trainings']",
    },
    {
      category: "Performance & Engagement",
      name: "Pulse Survey Response Rate",
      code: "df['survey_rr'] = df['responses'] / df['invited']",
    },
    {
      category: "Performance & Engagement",
      name: "High Performer Retention",
      code: "df['hp_retention'] = df[df['rating']=='exceeds']['retained'].mean()",
    },
    {
      category: "Compensation & Benefits",
      name: "Total Comp per FTE",
      code: "df['tc_fte'] = df['total_comp'] / df['fte']",
    },
    {
      category: "Compensation & Benefits",
      name: "Benefits Cost as % of Payroll",
      code: "df['benefits_pct'] = df['benefits_cost'] / df['total_payroll']",
    },
    {
      category: "Compensation & Benefits",
      name: "Revenue per Employee",
      code: "df['rev_emp'] = df['revenue'] / df['headcount']",
    },
    {
      category: "Compensation & Benefits",
      name: "Payroll as % of Revenue",
      code: "df['payroll_pct'] = df['total_payroll'] / df['revenue']",
    },
    {
      category: "Compensation & Benefits",
      name: "Equity Dilution Rate",
      code: "df['dilution'] = df['new_options_granted'] / df['total_shares_outstanding']",
    },
    {
      category: "Compensation & Benefits",
      name: "Below-Market Pay Flag",
      code: "df['below_market'] = (df['compa_ratio'] < 0.9).astype(int)",
    },
  ],
  INSURANCE: [
    {
      category: "Underwriting",
      name: "Loss Ratio",
      code: "df['loss_ratio'] = df['incurred_losses'] / df['earned_premiums']",
    },
    {
      category: "Underwriting",
      name: "Expense Ratio",
      code: "df['expense_ratio'] = df['underwriting_expenses'] / df['written_premiums']",
    },
    {
      category: "Underwriting",
      name: "Combined Ratio",
      code: "df['combined_ratio'] = df['loss_ratio'] + df['expense_ratio']",
    },
    {
      category: "Underwriting",
      name: "Operating Ratio",
      code: "df['operating_ratio'] = df['combined_ratio'] - df['investment_income_ratio']",
    },
    {
      category: "Underwriting",
      name: "Underwriting Profit",
      code: "df['uw_profit'] = df['earned_premiums'] - df['incurred_losses'] - df['uw_expenses']",
    },
    {
      category: "Underwriting",
      name: "Pure Premium",
      code: "df['pure_prem'] = df['losses'] / df['exposures']",
    },
    {
      category: "Underwriting",
      name: "Burning Cost",
      code: "df['burning_cost'] = df['actual_losses'] / df['original_premium']",
    },
    {
      category: "Underwriting",
      name: "Loss Frequency",
      code: "df['frequency'] = df['claim_count'] / df['policy_count']",
    },
    {
      category: "Underwriting",
      name: "Loss Severity",
      code: "df['severity'] = df['total_losses'] / df['claim_count']",
    },
    {
      category: "Underwriting",
      name: "Expected Loss",
      code: "df['expected_loss'] = df['frequency'] * df['severity']",
    },
    {
      category: "Underwriting",
      name: "Premium Adequacy",
      code: "df['adequacy'] = df['charged_premium'] / df['indicated_premium']",
    },
    {
      category: "Underwriting",
      name: "Risk-Adjusted Premium",
      code: "df['ra_premium'] = df['base_rate'] * df['risk_score'] * df['territory_factor']",
    },
    {
      category: "Underwriting",
      name: "Rate Change",
      code: "df['rate_chg'] = df['new_rate'] / df['old_rate'] - 1",
    },
    {
      category: "Underwriting",
      name: "Hit Ratio",
      code: "df['hit_ratio'] = df['policies_bound'] / df['quotes_issued']",
    },
    {
      category: "Underwriting",
      name: "Retention Rate",
      code: "df['retention'] = df['renewed_policies'] / df['expiring_policies']",
    },
    {
      category: "Claims",
      name: "Claims Frequency",
      code: "df['claim_freq'] = df['claims'] / df['policy_years']",
    },
    {
      category: "Claims",
      name: "Average Claim Cost",
      code: "df['avg_claim'] = df['paid_losses'] / df['closed_claims']",
    },
    {
      category: "Claims",
      name: "Claims Paid vs Reserved",
      code: "df['paid_ratio'] = df['paid'] / (df['paid'] + df['reserved'])",
    },
    {
      category: "Claims",
      name: "IBNR Reserve",
      code: "# Bornhuetter-Ferguson or chain-ladder method",
    },
    {
      category: "Claims",
      name: "Development Factor",
      code: "df['dev_factor'] = df['ultimate_losses'] / df['reported_losses']",
    },
    {
      category: "Claims",
      name: "Claim Cycle Time",
      code: "df['cycle_time'] = (df['close_date'] - df['report_date']).dt.days",
    },
    {
      category: "Claims",
      name: "Reopen Rate",
      code: "df['reopen_rate'] = df['reopened_claims'] / df['closed_claims']",
    },
    {
      category: "Claims",
      name: "Subrogation Recovery Rate",
      code: "df['subrog_rate'] = df['subrogation_recovered'] / df['subrogation_potential']",
    },
    {
      category: "Claims",
      name: "Fraud Indicator Score",
      code: "df['fraud_score'] = df[['late_report','prior_claims','inconsistent_story','attorney_rep']].dot([0.3,0.25,0.25,0.2])",
    },
    {
      category: "Claims",
      name: "SIU Referral Rate",
      code: "df['siu_rate'] = df['siu_referrals'] / df['total_claims']",
    },
    {
      category: "Claims",
      name: "Large Loss Ratio",
      code: "df['ll_ratio'] = df[df['claim_amount'] > df['large_loss_threshold']]['claim_amount'].sum() / df['total_losses'].sum()",
    },
    {
      category: "Claims",
      name: "Excess Loss Loading",
      code: "df['ell'] = df['losses_above_retention'] / df['total_losses']",
    },
    {
      category: "Actuarial",
      name: "Exposure Unit Count",
      code: "df['exposure'] = df['earned_car_years']  # or house-years, person-years",
    },
    {
      category: "Actuarial",
      name: "Credibility Weight (Bühlmann)",
      code: "df['z'] = df['n'] / (df['n'] + df['k'])  # k = variance ratio",
    },
    {
      category: "Actuarial",
      name: "Credibility-Weighted Loss Rate",
      code: "df['cred_rate'] = df['z'] * df['observed_rate'] + (1 - df['z']) * df['manual_rate']",
    },
    {
      category: "Actuarial",
      name: "Triangle Paid Development",
      code: "# pivot to triangle: df.pivot_table(index='acc_year', columns='dev_year', values='paid_losses')",
    },
    {
      category: "Actuarial",
      name: "Mortality Rate (Life)",
      code: "df['qx'] = df['deaths'] / df['exposed_to_risk']",
    },
    {
      category: "Actuarial",
      name: "Morbidity Rate",
      code: "df['morbidity'] = df['new_claims'] / df['covered_lives']",
    },
    {
      category: "Actuarial",
      name: "Lapse Rate",
      code: "df['lapse'] = df['lapsed_policies'] / df['in_force_policies']",
    },
    {
      category: "Actuarial",
      name: "Premium to Surplus Ratio",
      code: "df['pts'] = df['net_written_premium'] / df['policyholder_surplus']",
    },
    {
      category: "Actuarial",
      name: "Reserve to Premium Ratio",
      code: "df['rpr'] = df['loss_reserves'] / df['earned_premiums']",
    },
    {
      category: "Portfolio Risk",
      name: "Concentration by Line",
      code: "df.groupby('line_of_business')['written_premium'].sum() / df['written_premium'].sum()",
    },
    {
      category: "Portfolio Risk",
      name: "Catastrophe Load",
      code: "df['cat_load'] = df['cat_losses'] / df['earned_premiums']",
    },
    {
      category: "Portfolio Risk",
      name: "Maximum Possible Loss",
      code: "df['mpl'] = df['total_insured_value'] * df['damage_pct_worst']",
    },
    {
      category: "Portfolio Risk",
      name: "Probable Maximum Loss",
      code: "df['pml'] = df['total_insured_value'] * df['damage_pct_250yr']",
    },
    {
      category: "Portfolio Risk",
      name: "Return Period Loss",
      code: "df['rp250'] = df['losses'].quantile(1 - 1/250)",
    },
    {
      category: "Portfolio Risk",
      name: "Risk-Based Capital Ratio",
      code: "df['rbc'] = df['actual_capital'] / df['required_capital']",
    },
    {
      category: "Portfolio Risk",
      name: "Solvency Ratio",
      code: "df['solvency'] = df['eligible_own_funds'] / df['scr']",
    },
  ],
  CYBERSECURITY: [
    {
      category: "Threat Detection",
      name: "Alert Volume",
      code: "df['alert_vol'] = df.groupby(['date','source'])['alert_id'].transform('count')",
    },
    {
      category: "Threat Detection",
      name: "False Positive Rate",
      code: "df['fpr'] = df['false_positives'] / (df['false_positives'] + df['true_negatives'])",
    },
    {
      category: "Threat Detection",
      name: "True Positive Rate",
      code: "df['tpr'] = df['true_positives'] / (df['true_positives'] + df['false_negatives'])",
    },
    {
      category: "Threat Detection",
      name: "Alert-to-Incident Ratio",
      code: "df['a2i'] = df['incidents'] / df['alerts']",
    },
    {
      category: "Threat Detection",
      name: "Dwell Time (days)",
      code: "df['dwell'] = (df['detection_date'] - df['compromise_date']).dt.days",
    },
    {
      category: "Threat Detection",
      name: "Mean Time to Detect",
      code: "df['mttd'] = (df['detected_at'] - df['attack_started']).dt.total_seconds() / 3600",
    },
    {
      category: "Threat Detection",
      name: "Mean Time to Respond",
      code: "df['mttr'] = (df['contained_at'] - df['detected_at']).dt.total_seconds() / 3600",
    },
    {
      category: "Threat Detection",
      name: "Mean Time to Recover",
      code: "df['mttrc'] = (df['recovered_at'] - df['incident_at']).dt.total_seconds() / 3600",
    },
    {
      category: "Threat Detection",
      name: "Threat Severity Score",
      code: "df['severity'] = df['impact'] * df['likelihood'] * df['exploitability']",
    },
    {
      category: "Threat Detection",
      name: "CVSS Score Bucket",
      code: "df['cvss_tier'] = pd.cut(df['cvss'], bins=[0,3.9,6.9,8.9,10], labels=['low','medium','high','critical'])",
    },
    {
      category: "Threat Detection",
      name: "Lateral Movement Flag",
      code: "df['lateral'] = (df.groupby('session_id')['unique_hosts'].transform('max') > 3).astype(int)",
    },
    {
      category: "Threat Detection",
      name: "Beaconing Score",
      code: "df['beacon'] = 1 - df.groupby('src_ip')['interval_s'].transform('std') / df.groupby('src_ip')['interval_s'].transform('mean')",
    },
    {
      category: "Threat Detection",
      name: "Entropy of DNS Requests",
      code: "from scipy.stats import entropy; df['dns_entropy'] = df['dns_queries'].apply(lambda x: entropy(pd.Series(list(x)).value_counts(normalize=True)))",
    },
    {
      category: "Threat Detection",
      name: "Failed Login Rate",
      code: "df['fail_login_rate'] = df['failed_logins'] / df['total_login_attempts']",
    },
    {
      category: "Threat Detection",
      name: "Impossible Travel Flag",
      code: "df['impossible_travel'] = (df['distance_km'] / df['time_diff_hrs'] > 900).astype(int)",
    },
    {
      category: "Vulnerability Management",
      name: "Patch Coverage Rate",
      code: "df['patch_cov'] = df['patched_assets'] / df['total_assets']",
    },
    {
      category: "Vulnerability Management",
      name: "Mean Time to Patch",
      code: "df['mttp'] = (df['patch_date'] - df['disclosure_date']).dt.days",
    },
    {
      category: "Vulnerability Management",
      name: "SLA Breach Rate (Patching)",
      code: "df['patch_sla'] = (df['mttp'] > df['sla_days']).mean()",
    },
    {
      category: "Vulnerability Management",
      name: "Vulnerability Density",
      code: "df['vuln_density'] = df['open_vulns'] / df['total_assets']",
    },
    {
      category: "Vulnerability Management",
      name: "Critical Vuln Age",
      code: "df['crit_age'] = (pd.Timestamp.today() - df[df['severity']=='critical']['disclosure_date']).dt.days",
    },
    {
      category: "Vulnerability Management",
      name: "Remediation Rate",
      code: "df['remed_rate'] = df['closed_vulns'] / df['opened_vulns']",
    },
    {
      category: "Vulnerability Management",
      name: "Attack Surface Score",
      code: "df['attack_surface'] = df['internet_exposed_assets'] * df['avg_cvss']",
    },
    {
      category: "Vulnerability Management",
      name: "Risk Score by Asset",
      code: "df['asset_risk'] = df['cvss'] * df['asset_criticality'] * df['exploit_available'].astype(int)",
    },
    {
      category: "Access & Identity",
      name: "Privileged Account Ratio",
      code: "df['priv_ratio'] = df['privileged_accounts'] / df['total_accounts']",
    },
    {
      category: "Access & Identity",
      name: "Orphaned Account Rate",
      code: "df['orphan_rate'] = df['orphaned_accounts'] / df['total_accounts']",
    },
    {
      category: "Access & Identity",
      name: "MFA Adoption Rate",
      code: "df['mfa_rate'] = df['mfa_enabled'] / df['total_users']",
    },
    {
      category: "Access & Identity",
      name: "Password Age (days)",
      code: "df['pwd_age'] = (pd.Timestamp.today() - df['last_pwd_change']).dt.days",
    },
    {
      category: "Access & Identity",
      name: "Access Review Completion",
      code: "df['access_review'] = df['reviews_completed'] / df['reviews_due']",
    },
    {
      category: "Access & Identity",
      name: "Excessive Privilege Score",
      code: "df['excess_priv'] = df['permissions_granted'] - df['permissions_used']",
    },
    {
      category: "Access & Identity",
      name: "Service Account Risk",
      code: "df['sa_risk'] = (df['account_type']=='service') & (df['interactive_login']==1)",
    },
    {
      category: "Access & Identity",
      name: "Session Anomaly Score",
      code: "df['sess_anom'] = (df['session_duration'] > df['session_duration'].mean() + 3*df['session_duration'].std()).astype(int)",
    },
    {
      category: "Compliance & Posture",
      name: "Security Control Coverage",
      code: "df['ctrl_cov'] = df['implemented_controls'] / df['required_controls']",
    },
    {
      category: "Compliance & Posture",
      name: "Compliance Score",
      code: "df['compliance'] = df['passed_checks'] / df['total_checks']",
    },
    {
      category: "Compliance & Posture",
      name: "Policy Exception Rate",
      code: "df['exception_rate'] = df['approved_exceptions'] / df['total_policies']",
    },
    {
      category: "Compliance & Posture",
      name: "Audit Finding Rate",
      code: "df['audit_findings'] = df['open_findings'] / df['total_audits']",
    },
    {
      category: "Compliance & Posture",
      name: "Penetration Test Coverage",
      code: "df['pentest_cov'] = df['systems_tested'] / df['systems_in_scope']",
    },
    {
      category: "Compliance & Posture",
      name: "Security Training Completion",
      code: "df['sec_train'] = df['completed'] / df['required']",
    },
    {
      category: "Compliance & Posture",
      name: "Data Classification Coverage",
      code: "df['data_class'] = df['classified_assets'] / df['total_data_assets']",
    },
  ],
  ML_OPS: [
    {
      category: "Model Performance",
      name: "Accuracy",
      code: "df['accuracy'] = (df['tp'] + df['tn']) / (df['tp'] + df['tn'] + df['fp'] + df['fn'])",
    },
    {
      category: "Model Performance",
      name: "Precision",
      code: "df['precision'] = df['tp'] / (df['tp'] + df['fp'])",
    },
    {
      category: "Model Performance",
      name: "Recall",
      code: "df['recall'] = df['tp'] / (df['tp'] + df['fn'])",
    },
    {
      category: "Model Performance",
      name: "F1 Score",
      code: "df['f1'] = 2 * df['precision'] * df['recall'] / (df['precision'] + df['recall'])",
    },
    {
      category: "Model Performance",
      name: "F-Beta Score",
      code: "b=2; df['fbeta'] = (1+b**2)*df['precision']*df['recall']/(b**2*df['precision']+df['recall'])",
    },
    {
      category: "Model Performance",
      name: "Matthews Correlation Coeff",
      code: "from sklearn.metrics import matthews_corrcoef; matthews_corrcoef(y_true, y_pred)",
    },
    {
      category: "Model Performance",
      name: "Log Loss",
      code: "from sklearn.metrics import log_loss; log_loss(y_true, y_prob)",
    },
    {
      category: "Model Performance",
      name: "AUC-PR",
      code: "from sklearn.metrics import average_precision_score; average_precision_score(y_true, y_score)",
    },
    {
      category: "Model Performance",
      name: "Calibration Error",
      code: "df['ce'] = abs(df['predicted_prob'] - df['actual_rate'])",
    },
    {
      category: "Model Performance",
      name: "Lift at Top Decile",
      code: "df_sorted = df.sort_values('score', ascending=False); df_sorted.head(int(len(df)*0.1))['label'].mean() / df['label'].mean()",
    },
    {
      category: "Model Performance",
      name: "KS Statistic",
      code: "from scipy.stats import ks_2samp; ks_2samp(df[df['label']==1]['score'], df[df['label']==0]['score'])",
    },
    {
      category: "Model Performance",
      name: "Gini Coefficient (model)",
      code: "df['gini'] = 2 * df['auc'] - 1",
    },
    {
      category: "Model Performance",
      name: "RMSE",
      code: "df['rmse'] = np.sqrt(((df['pred'] - df['actual'])**2).mean())",
    },
    {
      category: "Model Performance",
      name: "MAE",
      code: "df['mae'] = (df['pred'] - df['actual']).abs().mean()",
    },
    {
      category: "Model Performance",
      name: "MAPE",
      code: "df['mape'] = (abs(df['pred'] - df['actual']) / abs(df['actual'])).mean() * 100",
    },
    {
      category: "Model Performance",
      name: "SMAPE",
      code: "df['smape'] = (abs(df['pred']-df['actual']) / ((abs(df['actual'])+abs(df['pred']))/2)).mean()*100",
    },
    {
      category: "Model Performance",
      name: "R-Squared",
      code: "ss_res = ((df['actual']-df['pred'])**2).sum(); ss_tot = ((df['actual']-df['actual'].mean())**2).sum(); r2 = 1 - ss_res/ss_tot",
    },
    {
      category: "Data Drift",
      name: "PSI (Population Stability Index)",
      code: "def psi(exp,act,bins=10): e,_=np.histogram(exp,bins=bins,density=True); a,_=np.histogram(act,bins=bins,density=True); return np.sum((a-e)*np.log(a/e+1e-9))",
    },
    {
      category: "Data Drift",
      name: "KL Divergence",
      code: "from scipy.special import kl_div; df['kl'] = kl_div(df['p_dist'], df['q_dist']).sum()",
    },
    {
      category: "Data Drift",
      name: "JS Divergence",
      code: "from scipy.spatial.distance import jensenshannon; jensenshannon(p, q)",
    },
    {
      category: "Data Drift",
      name: "Wasserstein Distance",
      code: "from scipy.stats import wasserstein_distance; wasserstein_distance(ref_data, current_data)",
    },
    {
      category: "Data Drift",
      name: "Chi-Square Drift Test",
      code: "from scipy.stats import chisquare; chisquare(f_obs=obs_counts, f_exp=exp_counts)",
    },
    {
      category: "Data Drift",
      name: "Feature Distribution Shift",
      code: "df['mean_shift'] = (df['current_mean'] - df['baseline_mean']) / df['baseline_std']",
    },
    {
      category: "Data Drift",
      name: "Prediction Drift",
      code: "df['pred_drift'] = df['current_pred_mean'].rolling(7).mean().pct_change()",
    },
    {
      category: "Data Drift",
      name: "Concept Drift Score",
      code: "df['concept_drift'] = df['current_accuracy'] / df['baseline_accuracy'] - 1",
    },
    {
      category: "Data Drift",
      name: "Missing Rate Drift",
      code: "df['miss_drift'] = df['current_missing_pct'] - df['baseline_missing_pct']",
    },
    {
      category: "Data Drift",
      name: "New Category Rate",
      code: "df['new_cat'] = df.apply(lambda r: r['value'] not in r['known_categories'], axis=1).mean()",
    },
    {
      category: "Model Ops",
      name: "Inference Latency P95",
      code: "df['latency_p95'] = df['inference_ms'].quantile(0.95)",
    },
    {
      category: "Model Ops",
      name: "Throughput (requests/sec)",
      code: "df['throughput'] = df['requests'] / df['elapsed_seconds']",
    },
    {
      category: "Model Ops",
      name: "Error Rate",
      code: "df['error_rate'] = df['failed_requests'] / df['total_requests']",
    },
    {
      category: "Model Ops",
      name: "Model Version Rollout %",
      code: "df['rollout_pct'] = df['traffic_new_model'] / df['total_traffic']",
    },
    {
      category: "Model Ops",
      name: "Shadow Mode Agreement Rate",
      code: "df['shadow_agree'] = (df['shadow_pred'] == df['prod_pred']).mean()",
    },
    {
      category: "Model Ops",
      name: "Retraining Trigger Flag",
      code: "df['retrain_flag'] = (df['psi'] > 0.2) | (df['accuracy_drop'] > 0.05)",
    },
    {
      category: "Model Ops",
      name: "Cost per Prediction",
      code: "df['cost_pred'] = df['compute_cost'] / df['predictions']",
    },
    {
      category: "Model Ops",
      name: "Feature Importance Stability",
      code: "df['fi_stability'] = df[['fi_v1','fi_v2']].corr().iloc[0,1]",
    },
    {
      category: "Model Ops",
      name: "Prediction Confidence Distribution",
      code: "df['conf_bucket'] = pd.cut(df['max_prob'], bins=[0,0.6,0.8,0.9,1.0], labels=['low','medium','high','very_high'])",
    },
    {
      category: "Model Ops",
      name: "Fairness Metric (Equalized Odds)",
      code: "df.groupby('group')[['tpr','fpr']].mean()",
    },
    {
      category: "Feature Quality",
      name: "Missing Rate",
      code: "df.isnull().mean()",
    },
    {
      category: "Feature Quality",
      name: "Zero Variance Flag",
      code: "df['zero_var'] = (df.std() == 0)",
    },
    {
      category: "Feature Quality",
      name: "Cardinality",
      code: "df.nunique()",
    },
    {
      category: "Feature Quality",
      name: "High Cardinality Flag",
      code: "df['high_card'] = df.nunique() > 0.5 * len(df)",
    },
    {
      category: "Feature Quality",
      name: "Outlier Rate (3-sigma)",
      code: "df['outlier_rate'] = (df['feat'].sub(df['feat'].mean()).abs() > 3*df['feat'].std()).mean()",
    },
    {
      category: "Feature Quality",
      name: "Correlation with Target",
      code: "df.corrwith(df['target']).sort_values(ascending=False)",
    },
    {
      category: "Feature Quality",
      name: "VIF (Multicollinearity)",
      code: "from statsmodels.stats.outliers_influence import variance_inflation_factor; [variance_inflation_factor(X.values, i) for i in range(X.shape[1])]",
    },
    {
      category: "Feature Quality",
      name: "Information Value (IV)",
      code: "# WoE bins, then IV = sum((p_events - p_non_events) * WoE)",
    },
    {
      category: "Feature Quality",
      name: "Mutual Information Score",
      code: "from sklearn.feature_selection import mutual_info_classif; mutual_info_classif(X, y)",
    },
    {
      category: "Feature Quality",
      name: "SHAP Value Mean Abs",
      code: "import shap; explainer=shap.TreeExplainer(model); shap_vals=explainer.shap_values(X); pd.Series(abs(shap_vals).mean(0), index=X.columns).sort_values(ascending=False)",
    },
  ],
  EDUCATION: [
    {
      category: "Student Performance",
      name: "GPA",
      code: "df['gpa'] = df.groupby('student_id')[['grade_points']].transform('mean')",
    },
    {
      category: "Student Performance",
      name: "Grade Change",
      code: "df['grade_chg'] = df.groupby('student_id')['grade'].diff()",
    },
    {
      category: "Student Performance",
      name: "Subject Pass Rate",
      code: "df['pass_rate'] = (df['grade'] >= df['pass_threshold']).mean()",
    },
    {
      category: "Student Performance",
      name: "At-Risk Flag",
      code: "df['at_risk'] = ((df['gpa'] < 2.0) | (df['attendance_pct'] < 0.8)).astype(int)",
    },
    {
      category: "Student Performance",
      name: "Percentile Rank in Cohort",
      code: "df['pct_rank'] = df.groupby(['cohort','subject'])['score'].rank(pct=True)",
    },
    {
      category: "Student Performance",
      name: "Value Added Score",
      code: "df['value_added'] = df['exit_score'] - df['predicted_exit_score']",
    },
    {
      category: "Student Performance",
      name: "Growth Percentile",
      code: "df['growth_pct'] = df['score_gain'].rank(pct=True)",
    },
    {
      category: "Student Performance",
      name: "Assignment Completion Rate",
      code: "df['completion'] = df['submitted'] / df['assigned']",
    },
    {
      category: "Student Performance",
      name: "Score Volatility",
      code: "df['score_vol'] = df.groupby('student_id')['score'].transform('std')",
    },
    {
      category: "Student Performance",
      name: "Time to Submission",
      code: "df['t2sub'] = (df['submit_time'] - df['assign_time']).dt.total_seconds() / 3600",
    },
    {
      category: "Engagement & Attendance",
      name: "Attendance Rate",
      code: "df['attend_rate'] = df['days_present'] / df['days_scheduled']",
    },
    {
      category: "Engagement & Attendance",
      name: "Chronic Absenteeism Flag",
      code: "df['chronic_absent'] = (df['attend_rate'] < 0.9).astype(int)",
    },
    {
      category: "Engagement & Attendance",
      name: "LMS Login Frequency",
      code: "df['lms_freq'] = df.groupby('student_id')['login_date'].transform('count')",
    },
    {
      category: "Engagement & Attendance",
      name: "Video Watch Rate",
      code: "df['watch_rate'] = df['minutes_watched'] / df['total_video_minutes']",
    },
    {
      category: "Engagement & Attendance",
      name: "Discussion Participation",
      code: "df['disc_rate'] = df['posts'] / df['discussions']",
    },
    {
      category: "Engagement & Attendance",
      name: "Days Since Last Login",
      code: "df['days_since_login'] = (pd.Timestamp.today() - df['last_login']).dt.days",
    },
    {
      category: "Engagement & Attendance",
      name: "Resource Access Breadth",
      code: "df['resource_breadth'] = df.groupby('student_id')['resource_type'].transform('nunique')",
    },
    {
      category: "Engagement & Attendance",
      name: "Peer Interaction Score",
      code: "df['peer_score'] = df['peer_reviews'] + df['replies'] + df['likes_given']",
    },
    {
      category: "Institutional",
      name: "Enrollment Rate",
      code: "df['enrollment_rate'] = df['enrolled'] / df['eligible_population']",
    },
    {
      category: "Institutional",
      name: "Graduation Rate",
      code: "df['grad_rate'] = df.groupby('cohort_year')['graduated'].transform('mean')",
    },
    {
      category: "Institutional",
      name: "Dropout Rate",
      code: "df['dropout_rate'] = df['dropped_out'] / df['enrolled_start']",
    },
    {
      category: "Institutional",
      name: "Student-to-Teacher Ratio",
      code: "df['str'] = df['students'] / df['teachers']",
    },
    {
      category: "Institutional",
      name: "Cost per Student",
      code: "df['cps'] = df['total_expenditure'] / df['enrollment']",
    },
    {
      category: "Institutional",
      name: "Revenue per Student",
      code: "df['rps'] = df['total_revenue'] / df['enrollment']",
    },
    {
      category: "Institutional",
      name: "Tuition Dependency Ratio",
      code: "df['tuition_dep'] = df['tuition_revenue'] / df['total_revenue']",
    },
    {
      category: "Institutional",
      name: "Research Revenue per Faculty",
      code: "df['research_ppf'] = df['research_grants'] / df['faculty_count']",
    },
    {
      category: "Institutional",
      name: "Financial Aid Penetration",
      code: "df['aid_rate'] = df['aid_recipients'] / df['enrolled']",
    },
    {
      category: "Institutional",
      name: "Transfer-Out Rate",
      code: "df['transfer_rate'] = df['transferred_out'] / df['enrolled']",
    },
    {
      category: "Institutional",
      name: "First-Gen Student Share",
      code: "df['first_gen_pct'] = df['first_gen'].mean()",
    },
  ],
} as const;
