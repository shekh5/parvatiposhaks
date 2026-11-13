import Cart from '../models/cart.model.js';
import ApiError from '../utils/apiError.js';

const variantLabel = (variant) => [variant.size, variant.color].filter(Boolean).join(' / ');

// Works out price and availability for a product, or one of its variants
export function resolveLine(product, variantId) {
  const hasVariants = product.variants && product.variants.length > 0;
  if (hasVariants) {
    if (!variantId) throw new ApiError(`Please choose a size or colour for ${product.name}`, 400);
    const variant = product.variants.id(variantId);
    if (!variant) throw new ApiError(`That option is no longer available for ${product.name}`, 400);
    return {
      variant,
      variantLabel: variantLabel(variant),
      unitPrice: variant.price ?? product.price,
      available: variant.stock,
    };
  }
  if (variantId) throw new ApiError(`${product.name} has no selectable options`, 400);
  return { variant: null, variantLabel: '', unitPrice: product.price, available: product.stock };
}

// Loads the cart with current prices. Items whose product or option was removed
// from the catalogue are dropped and the cart is saved without them.
export async function loadCart(userId) {
  const cart =
    (await Cart.findOne({ user: userId }).populate('items.product')) ||
    new Cart({ user: userId, items: [] });

  const lines = [];
  const kept = [];
  for (const item of cart.items) {
    if (!item.product) continue;
    let resolved;
    try {
      resolved = resolveLine(item.product, item.variantId);
    } catch {
      continue;
    }
    kept.push(item);
    lines.push({
      _id: item._id,
      product: item.product,
      variantId: item.variantId,
      variantLabel: resolved.variantLabel,
      quantity: item.quantity,
      unitPrice: resolved.unitPrice,
      lineTotal: resolved.unitPrice * item.quantity,
      available: resolved.available,
    });
  }

  if (kept.length !== cart.items.length) {
    cart.items = kept;
    await cart.save();
  }

  const itemsPrice = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { cart, lines, itemsPrice };
}

export const cartView = ({ lines, itemsPrice }) => ({
  items: lines.map((line) => ({
    _id: line._id,
    product: {
      _id: line.product._id,
      name: line.product.name,
      image: line.product.images?.[0]?.url || '',
      category: line.product.category,
    },
    variantId: line.variantId,
    variantLabel: line.variantLabel,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    available: line.available,
    inStock: line.available >= line.quantity,
  })),
  totalItems: lines.reduce((sum, line) => sum + line.quantity, 0),
  itemsPrice,
});

export async function clearCart(userId) {
  await Cart.updateOne({ user: userId }, { $set: { items: [] } });
}
