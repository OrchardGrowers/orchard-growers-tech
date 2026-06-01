const hash = (value = "") =>
  String(value)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

const makeAwb = (courier = "SHIP") => `${courier.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "SHIP"}${Date.now().toString().slice(-10)}`;

export const createMockProvider = (courierName, options = {}) => {
  const baseCost = Number(options.baseCost || 70);
  const etaDays = Number(options.etaDays || 4);
  const unavailablePins = new Set(options.unavailablePins || []);

  return {
    async checkServiceability(payload = {}) {
      const pincode = String(payload.customerDetails?.pincode || "");
      const weight = Number(payload.packageDetails?.deadWeightKg || payload.packageDetails?.weight || 1);
      const serviceable = Boolean(pincode) && !unavailablePins.has(pincode) && weight <= Number(options.maxWeightKg || 50);
      return {
        courier: courierName,
        serviceable,
        estimatedCost: serviceable ? baseCost + Math.ceil(weight * 22) + (hash(pincode) % 35) : 0,
        eta: serviceable ? `${etaDays}-${etaDays + 2} days` : "",
        reason: serviceable ? "" : "Pincode, weight, or package type is outside mock serviceability rules.",
      };
    },
    async estimateRate(payload = {}) {
      const service = await this.checkServiceability(payload);
      return {
        courier: courierName,
        serviceable: service.serviceable,
        estimatedCost: service.estimatedCost,
        eta: service.eta,
        reason: service.reason,
      };
    },
    async bookShipment(payload = {}) {
      const awbNumber = payload.awbNumber || makeAwb(courierName);
      return {
        courier: courierName,
        awbNumber,
        trackingUrl: `https://tracking.orchardgrowers.in/${encodeURIComponent(awbNumber)}`,
        labelUrl: `/api/logistics/label/${encodeURIComponent(awbNumber)}`,
        manifestUrl: `/api/logistics/manifest/${encodeURIComponent(awbNumber)}`,
        status: "Booked",
        raw: {
          mock: true,
          courier: courierName,
          message: "Mock booking response. TODO: replace with real courier API integration.",
        },
      };
    },
    async trackShipment(payload = {}) {
      const awbNumber = payload.awbNumber || payload.shipmentId || "";
      return {
        awbNumber,
        status: "In Transit",
        trackingHistory: [
          { status: "Booked", location: payload.pickupDetails?.pickupCity || "Pickup hub", at: new Date().toISOString() },
          { status: "In Transit", location: "Courier network", at: new Date().toISOString() },
        ],
      };
    },
    async cancelShipment(payload = {}) {
      return { courier: courierName, shipmentId: payload.shipmentId || payload.awbNumber || "", status: "Cancelled" };
    },
    async generateLabel(payload = {}) {
      const awbNumber = payload.awbNumber || payload.shipmentId || makeAwb(courierName);
      return {
        courier: courierName,
        awbNumber,
        labelUrl: `/api/logistics/label/${encodeURIComponent(awbNumber)}`,
      };
    },
  };
};
