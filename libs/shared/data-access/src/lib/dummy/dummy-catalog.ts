import { CafeProfile, Catalog, DiningTable, MenuCategory, ModifierGroup, Product } from '@ros/shared/domain';

/** Fictional demo café. Registration numbers are placeholders, not real identifiers. */
export const DUMMY_CAFE: CafeProfile = {
  name: 'Brew & Bite',
  tagline: 'Coffee · Kitchen · Bakery',
  branch: 'Koramangala, Bengaluru',
  gstin: '29AAAAA0000A1Z0',
  fssai: '00000000000000',
  invoicePrefix: 'BB',
};

const CATEGORIES: MenuCategory[] = [
  { id: 'coffee', name: 'Coffee', icon: '☕' },
  { id: 'tea', name: 'Tea & Coolers', icon: '🧋' },
  { id: 'breakfast', name: 'All-day Breakfast', icon: '🍳' },
  { id: 'sandwich', name: 'Sandwiches & Wraps', icon: '🥪' },
  { id: 'pizza', name: 'Pizza & Pasta', icon: '🍕' },
  { id: 'dessert', name: 'Desserts', icon: '🍰' },
];

const MODIFIER_GROUPS: Record<string, ModifierGroup> = {
  milk: {
    id: 'milk', name: 'Milk', min: 1, max: 1,
    modifiers: [
      { id: 'milk-regular', name: 'Regular milk', price: 0 },
      { id: 'milk-oat', name: 'Oat milk', price: 60 },
      { id: 'milk-almond', name: 'Almond milk', price: 60 },
    ],
  },
  extras: {
    id: 'extras', name: 'Extras', min: 0, max: 2,
    modifiers: [
      { id: 'x-shot', name: 'Extra shot', price: 40 },
      { id: 'x-vanilla', name: 'Vanilla syrup', price: 30 },
      { id: 'x-hazelnut', name: 'Hazelnut syrup', price: 30 },
    ],
  },
  sugar: {
    id: 'sugar', name: 'Sweetness', min: 1, max: 1,
    modifiers: [
      { id: 'sugar-regular', name: 'Regular sugar', price: 0 },
      { id: 'sugar-less', name: 'Less sugar', price: 0 },
      { id: 'sugar-none', name: 'No sugar', price: 0 },
    ],
  },
  toppings: {
    id: 'toppings', name: 'Add-ons', min: 0, max: 3,
    modifiers: [
      { id: 't-cheese', name: 'Extra cheese', price: 50 },
      { id: 't-jalapeno', name: 'Jalapeños', price: 30 },
      { id: 't-olive', name: 'Black olives', price: 30 },
      { id: 't-mushroom', name: 'Mushrooms', price: 40 },
    ],
  },
  eggs: {
    id: 'eggs', name: 'Eggs style', min: 1, max: 1,
    modifiers: [
      { id: 'egg-scrambled', name: 'Scrambled', price: 0 },
      { id: 'egg-sunny', name: 'Sunny side up', price: 0 },
      { id: 'egg-omelette', name: 'Omelette', price: 0 },
    ],
  },
  icecream: {
    id: 'icecream', name: 'Make it better', min: 0, max: 1,
    modifiers: [{ id: 'ic-scoop', name: 'Vanilla ice-cream scoop', price: 60 }],
  },
};

const sizes = (id: string, regular: number, large: number) => [
  { id: `${id}-r`, name: 'Regular', price: regular },
  { id: `${id}-l`, name: 'Large', price: large },
];
const single = (id: string, price: number) => [{ id: `${id}-std`, name: 'Standard', price }];

const PRODUCTS: Product[] = [
  // Coffee
  { id: 'espresso', categoryId: 'coffee', name: 'Espresso', emoji: '☕', foodType: 'veg', station: 'Bar', prepMinutes: 3,
    description: 'Double shot of our house blend, rich crema.', variants: single('espresso', 120), modifierGroupIds: ['extras'] },
  { id: 'americano', categoryId: 'coffee', name: 'Americano', emoji: '☕', foodType: 'veg', station: 'Bar', prepMinutes: 3,
    description: 'Espresso topped with hot water.', variants: sizes('americano', 150, 190), modifierGroupIds: ['extras'] },
  { id: 'cappuccino', categoryId: 'coffee', name: 'Cappuccino', emoji: '☕', foodType: 'veg', station: 'Bar', prepMinutes: 4, popular: true,
    description: 'Espresso, steamed milk and a thick layer of foam.', variants: sizes('cappuccino', 180, 220), modifierGroupIds: ['milk', 'extras', 'sugar'] },
  { id: 'latte', categoryId: 'coffee', name: 'Café Latte', emoji: '🥛', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    description: 'Smooth espresso with silky steamed milk.', variants: sizes('latte', 190, 230), modifierGroupIds: ['milk', 'extras', 'sugar'] },
  { id: 'flatwhite', categoryId: 'coffee', name: 'Flat White', emoji: '☕', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    description: 'Ristretto shots with velvety micro-foam.', variants: single('flatwhite', 200), modifierGroupIds: ['milk'] },
  { id: 'coldbrew', categoryId: 'coffee', name: 'Cold Brew', emoji: '🧊', foodType: 'veg', station: 'Bar', prepMinutes: 2, popular: true,
    description: 'Steeped for 18 hours. Served over ice.', variants: sizes('coldbrew', 220, 260), modifierGroupIds: ['sugar'] },
  { id: 'icedcaramel', categoryId: 'coffee', name: 'Iced Caramel Latte', emoji: '🧋', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    description: 'Espresso, caramel and cold milk over ice.', variants: sizes('icedcaramel', 240, 280), modifierGroupIds: ['milk', 'extras'] },
  { id: 'mocha', categoryId: 'coffee', name: 'Mocha', emoji: '🍫', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    description: 'Espresso with dark chocolate and steamed milk.', variants: sizes('mocha', 220, 260), modifierGroupIds: ['milk', 'extras'] },

  // Tea & coolers
  { id: 'chai', categoryId: 'tea', name: 'Masala Chai', emoji: '🫖', foodType: 'veg', station: 'Bar', prepMinutes: 5, popular: true,
    description: 'Assam tea brewed with ginger, cardamom and spices.', variants: sizes('chai', 90, 130), modifierGroupIds: ['sugar'] },
  { id: 'icedtea', categoryId: 'tea', name: 'Lemon Iced Tea', emoji: '🍋', foodType: 'veg', station: 'Bar', prepMinutes: 2,
    description: 'Fresh-brewed black tea, lemon and mint.', variants: single('icedtea', 160), modifierGroupIds: ['sugar'] },
  { id: 'smoothie', categoryId: 'tea', name: 'Mango Smoothie', emoji: '🥭', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    description: 'Alphonso mango, yoghurt and honey.', variants: single('smoothie', 210), modifierGroupIds: [] },
  { id: 'limesoda', categoryId: 'tea', name: 'Fresh Lime Soda', emoji: '🥤', foodType: 'veg', station: 'Bar', prepMinutes: 2,
    description: 'Fizzy, fresh and made to order.',
    variants: [{ id: 'limesoda-sweet', name: 'Sweet', price: 120 }, { id: 'limesoda-salted', name: 'Salted', price: 120 }, { id: 'limesoda-mixed', name: 'Mixed', price: 120 }],
    modifierGroupIds: [] },

  // Breakfast
  { id: 'eggs', categoryId: 'breakfast', name: 'Eggs Your Way', emoji: '🍳', foodType: 'egg', station: 'Kitchen', prepMinutes: 10,
    description: 'Two farm eggs with sourdough toast and butter.', variants: single('eggs', 220), modifierGroupIds: ['eggs'] },
  { id: 'avotoast', categoryId: 'breakfast', name: 'Avocado Toast', emoji: '🥑', foodType: 'veg', station: 'Kitchen', prepMinutes: 8, popular: true,
    description: 'Smashed avocado, chilli flakes, feta on sourdough.', variants: single('avotoast', 290), modifierGroupIds: [] },
  { id: 'pancakes', categoryId: 'breakfast', name: 'Pancake Stack', emoji: '🥞', foodType: 'egg', station: 'Kitchen', prepMinutes: 12,
    description: 'Three fluffy pancakes, maple syrup and berries.', variants: single('pancakes', 260), modifierGroupIds: ['icecream'] },
  { id: 'croissant', categoryId: 'breakfast', name: 'Butter Croissant', emoji: '🥐', foodType: 'veg', station: 'Kitchen', prepMinutes: 4,
    description: 'Flaky, buttery, baked in-house every morning.', variants: single('croissant', 140), modifierGroupIds: [] },
  { id: 'poha', categoryId: 'breakfast', name: 'Indori Poha', emoji: '🍛', foodType: 'veg', station: 'Kitchen', prepMinutes: 8,
    description: 'Flattened rice, peanuts, sev and a squeeze of lime.', variants: single('poha', 150), modifierGroupIds: [] },

  // Sandwiches & wraps
  { id: 'paneersandwich', categoryId: 'sandwich', name: 'Paneer Tikka Sandwich', emoji: '🥪', foodType: 'veg', station: 'Kitchen', prepMinutes: 10,
    description: 'Tandoori paneer, onions and mint mayo, grilled.', variants: single('paneersandwich', 240), modifierGroupIds: ['toppings'] },
  { id: 'chickenpanini', categoryId: 'sandwich', name: 'Chicken Pesto Panini', emoji: '🥪', foodType: 'nonveg', station: 'Kitchen', prepMinutes: 10, popular: true,
    description: 'Grilled chicken, basil pesto, mozzarella.', variants: single('chickenpanini', 290), modifierGroupIds: ['toppings'] },
  { id: 'vegclub', categoryId: 'sandwich', name: 'Veg Club Sandwich', emoji: '🥪', foodType: 'veg', station: 'Kitchen', prepMinutes: 9,
    description: 'Triple-decker with veggies, cheese and fries.', variants: single('vegclub', 220), modifierGroupIds: ['toppings'] },
  { id: 'caesarwrap', categoryId: 'sandwich', name: 'Chicken Caesar Wrap', emoji: '🌯', foodType: 'nonveg', station: 'Kitchen', prepMinutes: 9,
    description: 'Romaine, grilled chicken, parmesan, caesar dressing.', variants: single('caesarwrap', 270), modifierGroupIds: [] },

  // Pizza & pasta
  { id: 'margherita', categoryId: 'pizza', name: 'Margherita Pizza', emoji: '🍕', foodType: 'veg', station: 'Kitchen', prepMinutes: 14,
    description: 'San Marzano tomato, fior di latte, fresh basil.',
    variants: [{ id: 'margherita-8', name: '8" Regular', price: 320 }, { id: 'margherita-10', name: '10" Medium', price: 420 }], modifierGroupIds: ['toppings'] },
  { id: 'farmhouse', categoryId: 'pizza', name: 'Farmhouse Pizza', emoji: '🍕', foodType: 'veg', station: 'Kitchen', prepMinutes: 15, popular: true,
    description: 'Peppers, onion, corn, mushrooms and mozzarella.',
    variants: [{ id: 'farmhouse-8', name: '8" Regular', price: 380 }, { id: 'farmhouse-10', name: '10" Medium', price: 480 }], modifierGroupIds: ['toppings'] },
  { id: 'arrabbiata', categoryId: 'pizza', name: 'Penne Arrabbiata', emoji: '🍝', foodType: 'veg', station: 'Kitchen', prepMinutes: 12,
    description: 'Spicy tomato and garlic sauce, parmesan.', variants: single('arrabbiata', 310), modifierGroupIds: [] },
  { id: 'alfredo', categoryId: 'pizza', name: 'Chicken Alfredo Pasta', emoji: '🍝', foodType: 'nonveg', station: 'Kitchen', prepMinutes: 13,
    description: 'Fettuccine in a creamy parmesan sauce.', variants: single('alfredo', 360), modifierGroupIds: [] },

  // Desserts
  { id: 'brownie', categoryId: 'dessert', name: 'Chocolate Brownie', emoji: '🍫', foodType: 'egg', station: 'Bar', prepMinutes: 3, popular: true,
    description: 'Warm, fudgy, served with chocolate sauce.', variants: single('brownie', 160), modifierGroupIds: ['icecream'] },
  { id: 'cheesecake', categoryId: 'dessert', name: 'Blueberry Cheesecake', emoji: '🍰', foodType: 'egg', station: 'Bar', prepMinutes: 2,
    description: 'Baked New York style with blueberry compote.', variants: single('cheesecake', 250), modifierGroupIds: [] },
  { id: 'tiramisu', categoryId: 'dessert', name: 'Tiramisu', emoji: '🍮', foodType: 'egg', station: 'Bar', prepMinutes: 2,
    description: 'Espresso-soaked ladyfingers and mascarpone.', variants: single('tiramisu', 280), modifierGroupIds: [] },
];

export const DUMMY_TABLES: DiningTable[] = [
  ...[2, 2, 4, 4, 4, 6, 2, 4].map((capacity, i) => ({
    id: `t${i + 1}`, code: `T${i + 1}`, area: 'Indoor', capacity, status: 'Available' as const,
  })),
  ...[4, 4, 2, 6].map((capacity, i) => ({
    id: `p${i + 1}`, code: `P${i + 1}`, area: 'Patio', capacity, status: 'Available' as const,
  })),
];

export const DUMMY_CATALOG: Catalog = { categories: CATEGORIES, products: PRODUCTS, modifierGroups: MODIFIER_GROUPS };
