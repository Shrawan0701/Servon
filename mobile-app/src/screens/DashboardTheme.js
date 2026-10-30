// Scoped to the dashboard so its controls do not restyle other app screens.
export const dashboardWebCss = `
  .servon-dashboard {
    min-height: 100vh; overflow-y: auto; background: #F3F5F2;
    color: #20332A; font-family: 'DM Sans', sans-serif;
  }
  .servon-dashboard *, .servon-dashboard *::before, .servon-dashboard *::after { box-sizing: border-box; }
  .servon-dashboard button { font-family: inherit; }
  .servon-dashboard button:focus-visible { outline: 3px solid #83AF96; outline-offset: 3px; }
  .servon-dashboard button:disabled { opacity: .55; cursor: wait; }
  .servon-dashboard .servon-web-header { background: #fff; border-bottom: 1px solid #DFE5DF; }
  .servon-dashboard-header-inner {
    max-width: 1400px; min-height: 76px; margin: 0 auto; padding: 12px 36px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .servon-restaurant-brand { display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 700; min-width: 0; }
  .servon-restaurant-brand > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .servon-restaurant-icon { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; background: #EDF2EC; border: 1px solid #DFE8DF; border-radius: 11px; }
  .servon-dashboard-main { max-width: 1400px; margin: 0 auto; padding: 32px 36px 64px; }
  .servon-dashboard-heading { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 24px; }
  .servon-dashboard-date { font-size: 13px; color: #627166; margin: 0 0 6px; }
  .servon-dashboard-heading h1 { margin: 0; font-size: 30px; letter-spacing: -.9px; font-weight: 700; line-height: 1.25; }
  .servon-dashboard-greeting { margin: 6px 0 0; font-size: 14px; color: #627166; }
  .servon-dashboard-actions, .servon-dashboard-tools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .servon-dashboard-button {
    min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: #fff; border: 1px solid #D9E1D9; border-radius: 8px; padding: 11px 15px;
    color: #344E3E; font-size: 14px; font-weight: 600; cursor: pointer; line-height: 1.3;
    transition: background .15s, border-color .15s;
  }
  .servon-dashboard-button:hover { background: #EAF0E9; border-color: #AEC2AF; }
  .servon-dashboard-button.primary { background: #244F3B; border-color: #244F3B; color: #fff; padding-inline: 20px; }
  .servon-dashboard-button.primary:hover { background: #173F2B; }
  .servon-dashboard-button.quiet { background: transparent; border-color: transparent; padding: 9px 10px; font-size: 13px; }
  .servon-dashboard-button.quiet:hover { background: #E6ECE5; }
  .servon-dashboard .servon-stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px;
    padding: 0; margin: 22px 0 30px;
  }
  .servon-dashboard .servon-stat-card {
    min-width: 0; background: #fff; border: 1px solid #DFE5DF; border-radius: 12px;
    padding: 20px; display: flex; flex-direction: column; gap: 18px;
    box-shadow: 0 2px 3px #20332A03;
  }
  .servon-dashboard .servon-stat-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .servon-dashboard .servon-stat-label { font-size: 14px; font-weight: 500; color: #54655A; line-height: 1.4; }
  .servon-dashboard .servon-stat-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; flex-shrink: 0; }
  .servon-dashboard .servon-stat-value { font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 1.2; color: #20332A; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .servon-dashboard-orders { border-top: 1px solid #DDE4DC; padding-top: 22px; }
  .servon-dashboard-order-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
  .servon-dashboard-order-title { display: flex; align-items: center; gap: 10px; }
  .servon-dashboard-order-title h2 { font-size: 20px; font-weight: 700; letter-spacing: -.4px; margin: 0; }
  .servon-dashboard-order-count { font-size: 13px; font-weight: 700; color: #365A42; padding: 4px 9px; background: #E2EBDF; border-radius: 6px; }
  .servon-dashboard .servon-live-dot { width: 8px; height: 8px; background: #43855A; border-radius: 50%; box-shadow: 0 0 0 4px #E3ECE0; }
  .servon-dashboard-order-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
  .servon-dashboard .servon-order-card { background: #fff; border: 1px solid #DDE4DC; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 3px #20332A03; }
  .servon-order-heading { padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid #E9EDE7; }
  .servon-order-table { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .servon-order-table-icon { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid #D8E2D5; border-radius: 9px; background: #F0F4ED; flex-shrink: 0; }
  .servon-order-table strong { display: block; font-size: 18px; font-weight: 700; }
  .servon-order-time { display: flex; align-items: center; gap: 4px; color: #6B786F; font-size: 12px; margin-top: 4px; }
  .servon-order-status { display: flex; align-items: center; gap: 6px; border-radius: 6px; padding: 6px 9px; font-size: 12px; font-weight: 600; }
  .servon-order-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .servon-order-items { padding: 8px 20px; }
  .servon-order-item { display: flex; align-items: center; gap: 10px; min-height: 48px; border-bottom: 1px solid #F0F2EE; }
  .servon-order-item:last-child { border-bottom: 0; }
  .servon-order-quantity { min-width: 30px; padding: 4px 6px; text-align: center; font-size: 13px; font-weight: 700; color: #36543F; background: #F0F4ED; border-radius: 5px; }
  .servon-order-name { flex: 1; font-size: 15px; line-height: 1.45; color: #283B30; overflow-wrap: anywhere; }
  .servon-order-remove { width: 40px; height: 40px; display: grid; place-items: center; flex-shrink: 0; background: transparent; border: 0; border-radius: 7px; cursor: pointer; }
  .servon-order-remove:hover { background: #FEF0ED; }
  .servon-order-note { display: flex; gap: 7px; background: #FFF7E5; color: #825A1E; font-size: 13px; line-height: 1.5; padding: 10px 12px; margin: 4px 20px 14px; border-radius: 7px; }
  .servon-order-footer { border-top: 1px solid #E9EDE7; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; background: #FCFDFB; }
  .servon-order-total { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: #627166; }
  .servon-order-total strong { font-size: 21px; font-weight: 700; color: #20332A; font-variant-numeric: tabular-nums; }
  .servon-order-buttons { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .servon-dashboard .servon-empty { padding: 60px 24px; background: #fff; border: 1px solid #DFE5DF; border-radius: 12px; display: flex; align-items: center; flex-direction: column; gap: 10px; text-align: center; color: #627166; font-size: 14px; }
  .servon-dashboard .servon-empty strong { font-size: 17px; color: #344C3B; }
  .servon-dashboard-empty-icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 16px; background: #EFF4EB; margin-bottom: 5px; }
  .servon-dashboard .servon-profile-menu { width: 270px; max-height: calc(100vh - 100px); overflow-y: auto; }
  .servon-dashboard .servon-profile-menu-item { min-height: 46px; font-size: 14px; }
  .servon-dashboard .servon-profile-menu-item:hover { background: #EFF4EB; }
  .servon-dashboard-mobile-actions { display: none; }
  @media (min-width: 1500px) { .servon-dashboard-order-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px) {
    .servon-dashboard-header-inner { padding-inline: 22px; }
    .servon-dashboard-main { padding: 26px 22px 80px; }
    .servon-dashboard .servon-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .servon-dashboard-order-heading { align-items: flex-start; }
    .servon-dashboard-tools { gap: 2px; }
    .servon-dashboard-heading { align-items: flex-start; }
    .servon-dashboard-actions { justify-content: flex-end; }
  }
  @media (max-width: 650px) {
    .servon-dashboard-header-inner { min-height: 66px; padding: 10px 16px; gap: 8px; }
    .servon-restaurant-brand { font-size: 17px; gap: 8px; }
    .servon-restaurant-icon { display: none; }
    .servon-dashboard-main { padding: 22px 16px 120px; }
    .servon-dashboard-heading { gap: 12px; margin-bottom: 20px; }
    .servon-dashboard-heading h1 { font-size: 26px; }
    .servon-dashboard-date { font-size: 12px; }
    .servon-dashboard-actions .servon-desktop-create { display: none; }
    .servon-dashboard-actions > button { padding-inline: 10px; font-size: 12px; }
    .servon-dashboard .servon-stats-grid { gap: 10px; margin: 18px 0 24px; }
    .servon-dashboard .servon-stat-card { padding: 15px; gap: 12px; }
    .servon-dashboard .servon-stat-label { font-size: 13px; }
    .servon-dashboard .servon-stat-icon { width: 27px; height: 27px; }
    .servon-dashboard .servon-stat-value { font-size: 28px; }
    .servon-dashboard-order-grid { grid-template-columns: minmax(0, 1fr); }
    .servon-dashboard-order-heading { gap: 10px; }
    .servon-dashboard-tools { width: 100%; border-top: 1px solid #E0E7DD; padding-top: 8px; }
    .servon-dashboard-button.quiet { padding-inline: 5px; gap: 5px; font-size: 12px; }
    .servon-order-heading { padding: 16px; }
    .servon-order-items { padding-inline: 16px; }
    .servon-order-footer { padding: 14px 16px; gap: 10px; }
    .servon-order-buttons .servon-dashboard-button { padding-inline: 11px; font-size: 13px; }
    .servon-dashboard-mobile-actions { position: fixed; right: 16px; bottom: 84px; display: flex; gap: 10px; align-items: center; z-index: 90; }
  }
`;
