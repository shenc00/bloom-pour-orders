// Fallback menu and fixed shop settings. Day to day, sales are set up in /admin (Sale setup);
// this file is used until the first sale is published, and for settings that rarely change.
export const MENU = {
  shop: "Bloom Pour",
  tagline: "Pour over menu",
  contactName: "Sally",
  contactPhone: "91142310",
  eventDate: "Sunday 4/10",
  hours: "8.30am – 4pm",
  collectionPoint: "Blk 6 basement / level 1 lobby",
  estate: "Ki Residences",
  freeDeliveryMinCups: 4,
  notes: [
    "Light and medium-light roasts, fruity and citrusy",
    "All coffees are served hot, brewed with 15g of coffee per cup",
  ],
  slots: ["8.30am – 10am", "10am – 12pm", "12pm – 2pm", "2pm – 4pm"],
  items: [
    { id: "gesha", origin: "Colombia", name: "Diviso Gesha", price: 7, cap: 3,
      process: "Double Anaerobic, Washed", taste: "Lemongrass, Figs, Grapefruit finish" },
    { id: "landrace", origin: "Colombia", name: "Diviso Landrace", price: 6, cap: 3,
      process: "Double Anaerobic, Washed", taste: "Berries, Lavender, Apricot" },
    { id: "kenya", origin: "Kenya", name: "AB Mwirua Getuya", price: 6, cap: 10,
      process: "Washed", taste: "Currants, Rosehip, Brown Sugar, Strawberry Tea" },
  ],
};
