# Domain Glossary — Metal Processing

Written to learn the business before any technical design. Plain-language definitions,
tied to the assignment's example scenario.

## The flow
Supplier → **PO** → **Receiving** → **Inventory** (at a **Location**) → **WO** → Inventory → **SO** → Customer (in a **Container**) → **Reports**

## Documents (the paperwork)

| Term | What it is | In the scenario |
|---|---|---|
| **PO: Purchase Order** | A record of what we agreed to buy from a supplier: which products, how many lbs, at what $/lb. It's a promise, not material in hand. | PO #2201: 40,000 lbs HR coil @ $0.42 + 5,000 lbs aluminum @ $1.35 = $23,550 |
| **Receiving** | The event where the material physically arrives and the PO lines become real inventory. Each item gets put somewhere and keeps its cost from the PO. | Coil tagged C-1001 → Bay 2; aluminum → Rack 1 |
| **WO: Work Order** | An instruction to process material: use up one inventory item and produce new ones. The input's cost moves to the outputs. | C-1001 → 4 × 12" slit coils (9,900 lbs each) + 400 lbs scrap |
| **SO: Sales Order** | A record of what we sold to a customer: which items, the weight, the $/lb. Here it also means shipping it. | SO #5001: 2 slit coils, 19,800 lbs @ $0.55 = $10,890 |

## Things

| Term | What it is |
|---|---|
| **Product** | A *type* of material in the catalog (e.g., "12-inch Slit Coil"). It has default prices. It is not a physical thing. |
| **Inventory item / lot** | One *physical* piece or batch of a product that sits somewhere and has a weight and a cost (e.g., coil C-1001). |
| **Tag** | The ID physically attached to an item so people can find it on the floor (C-1001). Optional extra in the assignment: a barcode/QR on it. |
| **Location** | Where an item sits in the warehouse: a bay (floor area), a rack (shelving), a bin (container, e.g., the Scrap Bin). |
| **Vendor** | The PDF uses it for both sides: supplier (we buy from them) and customer (we sell to them). |
| **Container** | A shipping container (the big steel box on a truck, train or ship). The sale ships out in one. |

## Metal terms

| Term | What it is |
|---|---|
| **Coil** | Sheet steel rolled up like a giant roll of tape. It's the standard way flat steel is stored and moved. |
| **Hot-rolled (HR) steel** | Steel rolled while very hot. Cheaper and rougher than cold-rolled. A common raw material. |
| **Slitting** | Unrolling a wide coil and cutting it lengthwise into several narrower coils ("slit coils"), which are what customers order. |
| **Edge trim / scrap** | The uneven strips cut off the edges during slitting. They can't be sold as product, only as scrap metal for a low price. |
| **Grading** | Looking at the material to judge its quality and condition before buying. Grade drives what it's worth. |
| **$/lb** | Metal is bought and sold by weight. Price = lbs × $/lb. |
| **Yield** | How much of the input became sellable product: 39,600 / 40,000 = 99% here. |

## Money terms

| Term | What it is |
|---|---|
| **Cost basis** | What an item cost us. It starts at the PO price and moves through work orders. |
| **Cost carry-over** | When C-1001 ($16,800) is slit, the outputs share that $16,800. In the scenario the good coils take all of it and scrap gets $0, so each good coil = $16,800 × 9,900/39,600 = $4,200. |
| **Profit** | Sale price − cost. SO #5001: $10,890 − $8,400 = $2,490. |
| **Margin** | Profit ÷ **sale price** = 22.9%. (Not markup, which is profit ÷ cost = 29.6%.) |
| **Traceability / lineage** | Being able to follow an item backward: this slit coil came from WO X, which used C-1001, which came from PO #2201. The evaluators grade this explicitly. |
