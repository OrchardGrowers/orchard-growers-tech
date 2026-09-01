import { isLiveDeal } from "./marketplaceVisibility";

export const getCurrentlyLiveTradableLots = (lots = []) =>
  (Array.isArray(lots) ? lots : []).filter(isLiveDeal);

export const getNotificationsDashboardMetrics = ({
  marketplaceLots = [],
  notifications = [],
} = {}) => ({
  latestLots: getCurrentlyLiveTradableLots(marketplaceLots).length,
  unread: (Array.isArray(notifications) ? notifications : []).filter(
    (notification) => !notification.read
  ).length,
});
