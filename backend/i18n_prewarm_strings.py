"""Top 200 most-visited UI strings — pre-warmed into the Bengali i18n cache
on backend startup so first-paint of common pages is instant for users
visiting in Bangla mode.

Strings are extracted from the React frontend (Layout, Landing, Dashboard,
Products, Orders, Cart, Profile, VIN Lookup, Visual Search, Job Cards, etc.)
"""

PREWARM_STRINGS = [
    # Navigation / global
    "Trade Portal", "Admin Console", "Workshop Portal", "Dashboard", "Insights",
    "Quick Tools", "Signature Kits", "Service Packs", "Products", "VIN Lookup",
    "Recurring", "Fleets", "Job Cards", "Visual Search", "Request Any Part",
    "Cart", "Orders", "Returns", "Team", "Profile & KYC", "Sign in", "Sign out",
    "Save", "Cancel", "Back", "Loading…", "Add to Cart", "Add to cart",
    "Your Price", "Retail", "save", "Includes",

    # Landing
    "Bangladesh's first AI-powered B2B auto parts platform.",
    "Smart parts. Powerful journeys. One platform.",
    "Sign in to start ordering",
    "Catalog", "WhatsApp", "Retail Store",
    "Lookup parts", "Type a VIN. Get parts.",
    "Reserve a private viewing →", "Visit retail website",
    "Live · World Auto News", "Live",

    # Dashboard
    "Welcome back", "Available credit", "Total orders", "lifetime", "active orders",
    "CREDIT STATUS", "LIMIT", "USED", "Your JOY ID", "Copy ID", "FEATURED · IN STOCK",
    "your bay floor", "View kit details",

    # Products / Catalog
    "Auto Parts & Consumables", "Find parts for your car",
    "Search by name, SKU, brand or speak…", "Brand · any", "Pick a brand first",
    "Pick a model first", "All", "Body Kits", "Brake", "Engine", "Suspension",
    "Electrical", "Drivetrain", "Fluids", "Modifications", "Performance",
    "Accessories", "Lighting", "Tyres & Wheels", "Tools", "Audio", "Filter",
    "Cooling", "Transmission", "Exhaust", "Other", "GOLD PRICE", "SILVER PRICE",
    "MOQ", "Add", "out of stock", "in stock",

    # Orders
    "No orders yet", "Place order", "Subtotal", "Checkout",
    "Invoice", "Reorder", "Request Return", "Tracking",
    "Placed", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled",
    "Out for Delivery", "Mark complete", "Start", "Details, parts, push to cart",

    # Cart
    "Your cart is empty", "Continue shopping", "Place this order",

    # Profile / KYC
    "Profile", "KYC", "Trade License", "TIN Certificate", "Upload",
    "Pricing tier", "gold", "silver", "platinum", "retail",
    "Approved", "Pending", "Rejected", "Not submitted",

    # VIN Lookup
    "VIN LOOKUP · FIND PARTS",
    "Decode any vehicle's VIN through the global NHTSA database. We match in-stock JOY parts and use AI to suggest cross-reference part numbers for everything else — with a one-tap request to our sourcing team for unstocked items.",
    "VINs are stamped on the dashboard or driver-side door jamb · 17 chars",
    "Include AI part suggestions (slower, ~5s)", "Saved VINs",
    "Enter 17-character VIN (e.g. JTDBR32E430072456)",

    # Visual Search
    "AI Visual Tools", "Visual Parts Search",
    "Snap a photo of a broken or worn part — Claude Sonnet 4.5 vision identifies it and matches against your tier-priced catalog.",
    "Part photo", "Optional hint", "Take photo", "Upload from device",
    "Identify part", "Identification", "Catalog matches",
    "New search", "Analysing image…", "confident",

    # Job Cards
    "Workshop Management", "Job Cards",
    "Track customer jobs, link parts to each repair, push to cart with one tap.",
    "All statuses", "Open", "In progress", "Completed", "New job",
    "Customer name", "Phone (optional)", "Brand", "Model", "Year", "Plate",
    "VIN (17 chars, optional)", "Complaint / symptoms", "Mechanic", "Notes",
    "Create job", "Required parts", "No parts added yet.", "Edit", "Push parts to cart",
    "Add SKU (e.g. JA-BRK-001)", "Qty", "Labour ৳",
    "Share with customer", "Download PDF", "Customer view",

    # Team
    "Workspace", "Team & Roles",
    "Invite your parts manager, mechanic, or accountant to share this Joy ID workspace. Each member sees the same orders, credit and inventory.",
    "Invite a teammate", "Manager", "Parts Manager", "Mechanic", "Accountant",
    "Send invite", "Team members", "Pending invitations",
    "Owner", "Copy link", "Copied", "Revoke",

    # Fleets
    "Fleet Command Center", "Saved Fleets",
    "Group your repeat customers' vehicles into fleets for one-tap reordering of past parts.",
    "New fleet", "No fleets yet", "vehicle", "vehicles", "Add vehicle",
    "Show one-tap reorder list", "Add all to cart",
    "Suggested reorder", "stock", "Computing…",

    # Returns
    "Request a Return", "Submit Return Request", "No return requests yet",
    "Returns are only available within 7 days of delivery.",
    "Returns accepted within 7 days of delivery.", "Overall reason",

    # Common toast / errors
    "Failed", "Saved", "Created", "Deleted", "Updated", "Copied to clipboard",
    "Something went wrong. Please try again.", "Network error",

    # Misc footer / chat
    "Need help? Chat with JOY AI",
    "Bangladesh's first AI-powered B2B auto parts platform",
]
