function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOptionalText(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalCents(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function parseOptionalFlatwareQty(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function parseOptionalServiceDate(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

// Options may arrive as a legacy plain name (older payloads) or as a
// { name, priceDeltaCents } record exposed by the current print API.
function parseSelectedOption(value) {
  if (isNonEmptyText(value)) {
    return { name: value.trim() };
  }
  if (isRecord(value) && isNonEmptyText(value.name)) {
    const priceDeltaCents = parseOptionalCents(value.priceDeltaCents);
    if (priceDeltaCents === null) {
      return null;
    }
    return {
      ...(priceDeltaCents === undefined ? {} : { priceDeltaCents }),
      name: value.name.trim(),
    };
  }
  return null;
}

function parseTicketItem(value) {
  if (!isRecord(value) || !isNonEmptyText(value.name) || !Number.isInteger(value.quantity) || value.quantity < 1) {
    return null;
  }

  if (!Array.isArray(value.selectedOptions)) {
    return null;
  }
  const selectedOptions = value.selectedOptions.map(parseSelectedOption);
  if (selectedOptions.some((option) => option === null)) {
    return null;
  }

  const code = parseOptionalText(value.code);
  if (code === null) {
    return null;
  }

  const unitPriceCents = parseOptionalCents(value.unitPriceCents);
  if (unitPriceCents === null) {
    return null;
  }

  const lineTotalCents = parseOptionalCents(value.lineTotalCents);
  if (lineTotalCents === null) {
    return null;
  }

  return {
    ...(code === undefined ? {} : { code }),
    ...(unitPriceCents === undefined ? {} : { unitPriceCents }),
    ...(lineTotalCents === undefined ? {} : { lineTotalCents }),
    name: value.name.trim(),
    quantity: value.quantity,
    selectedOptions,
  };
}

export function parseTicketOrder(value) {
  if (
    !isRecord(value) ||
    !isNonEmptyText(value.number) ||
    (value.type !== "DELIVERY" && value.type !== "TAKEAWAY") ||
    !isNonEmptyText(value.customerName) ||
    !isNonEmptyText(value.customerPhone) ||
    !Number.isInteger(value.totalCents) ||
    value.totalCents < 0 ||
    !isNonEmptyText(value.createdAt) ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  if (value.address !== undefined && !isNonEmptyText(value.address)) {
    return null;
  }

  const items = value.items.map(parseTicketItem);
  if (items.some((item) => item === null)) {
    return null;
  }

  const sauce = parseOptionalText(value.sauce);
  const note = parseOptionalText(value.note);
  const paymentMethod = parseOptionalText(value.paymentMethod);
  const flatwareQty = parseOptionalFlatwareQty(value.flatwareQty);
  const subtotalCents = parseOptionalCents(value.subtotalCents);
  const deliveryFeeCents = parseOptionalCents(value.deliveryFeeCents);
  const customerEmail = parseOptionalText(value.customerEmail);
  const timeWindow = parseOptionalText(value.timeWindow);
  const serviceDate = parseOptionalServiceDate(value.serviceDate);
  if (
    sauce === null ||
    note === null ||
    paymentMethod === null ||
    flatwareQty === null ||
    subtotalCents === null ||
    deliveryFeeCents === null ||
    customerEmail === null ||
    timeWindow === null ||
    serviceDate === null
  ) {
    return null;
  }

  return {
    ...(value.address === undefined ? {} : { address: value.address.trim() }),
    ...(sauce === undefined ? {} : { sauce }),
    ...(flatwareQty === undefined ? {} : { flatwareQty }),
    ...(note === undefined ? {} : { note }),
    ...(paymentMethod === undefined ? {} : { paymentMethod }),
    ...(subtotalCents === undefined ? {} : { subtotalCents }),
    ...(deliveryFeeCents === undefined ? {} : { deliveryFeeCents }),
    ...(customerEmail === undefined ? {} : { customerEmail }),
    ...(timeWindow === undefined ? {} : { timeWindow }),
    ...(serviceDate === undefined ? {} : { serviceDate }),
    createdAt: value.createdAt,
    customerName: value.customerName.trim(),
    customerPhone: value.customerPhone.trim(),
    items,
    number: value.number.trim(),
    totalCents: value.totalCents,
    type: value.type,
  };
}