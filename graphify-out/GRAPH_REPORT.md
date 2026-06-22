# Graph Report - . (2026-06-16)

## Corpus Check

- cluster-only mode — file stats not available

## Summary

- 104 nodes · 179 edges · 7 communities (6 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `200c2119`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

## God Nodes (most connected - your core abstractions)

1. `apiError` - 7 edges
2. `apiFunctionality` - 6 edges
3. `apiResponse` - 5 edges
4. `asyncHandler()` - 5 edges
5. `verifyUserAuth` - 4 edges
6. `roleBasedAccess()` - 4 edges
7. `User` - 4 edges
8. `validateRequest()` - 3 edges
9. `app` - 2 edges
10. `registerUser` - 2 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Import Cycles

- None detected.

## Communities (7 total, 1 thin omitted)

### Community 0 - "Community 0"

Cohesion: 0.14
Nodes (18): deleteUser, getSingleUser, getUserDetail, getUserList, loginUser, logout, registerUser, requestPasswordReset (+10 more)

### Community 1 - "Community 1"

Cohesion: 0.16
Nodes (13): createOrder, deleteOrder, getAllOrders, getSingleOrder, myOrders, updateOrderStatus, roleBasedAccess(), verifyUserAuth (+5 more)

### Community 2 - "Community 2"

Cohesion: 0.21
Nodes (11): createProduct, createProductReview, deleteProduct, deleteReview, getAdminProducts, getAllProducts, getProductReviews, getSingleProduct (+3 more)

### Community 3 - "Community 3"

Cohesion: 0.12
Nodes (16): dependencies, bcryptjs, cloudinary, cookie-parser, cookieparser, cors, crypto, dotenv (+8 more)

### Community 4 - "Community 4"

Cohesion: 0.20
Nodes (9): author, description, license, main, name, scripts, start, type (+1 more)

### Community 5 - "Community 5"

Cohesion: 0.28
Nodes (6): app, dbConnect(), server, router, router, router

## Knowledge Gaps

- **27 isolated node(s):** `server`, `orderSchema`, `productSchema`, `userSchema`, `name` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFunctionality` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 3` to `Community 4`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `apiError` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `server`, `orderSchema`, `productSchema` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14492753623188406 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
