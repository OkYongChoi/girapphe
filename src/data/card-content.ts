// ============================================================
// Core knowledge content for practice cards
// summary  — one-sentence definition of what it IS
// explanation — key formula / theorem / rule + core insight
// ============================================================

export const CARD_CONTENT: Record<string, { summary: string; explanation: string }> = {

  // ── LINEAR ALGEBRA ────────────────────────────────────────────
  linear_algebra: {
    summary: 'The study of vector spaces, linear maps, and systems of linear equations',
    explanation: 'Core tools: matrix multiplication, eigendecomposition, SVD.\nFoundation for PCA, Kalman filter, neural-network weight updates, and most of ML.',
  },
  vector_spaces: {
    summary: 'A set closed under vector addition and scalar multiplication (satisfying 8 axioms)',
    explanation: 'Basis: minimal spanning set. dim(V) = # basis vectors.\nR^n, polynomials, and matrices are all vector spaces.\nKey: every element is a unique linear combination of basis vectors.',
  },
  matrix_multiplication: {
    summary: 'C = AB where C_{ij} = Σ_k A_{ik}B_{kj}; represents composition of linear maps',
    explanation: 'NOT commutative: AB ≠ BA in general. Associative: (AB)C = A(BC).\nIf A is m×k and B is k×n, C is m×n. Naive O(n³); Strassen O(n^{2.81}).\nDot-product view: C_{ij} = row_i(A) · col_j(B).',
  },
  eigenvalues_eigenvectors: {
    summary: 'Av = λv: eigenvector v is only scaled (not rotated) by matrix A; λ is the eigenvalue',
    explanation: 'Find λ: det(A − λI) = 0 (characteristic polynomial).\nDiagonalization: A = P D P^{−1}, D = diag(λ₁,…,λₙ).\nApplications: PCA, Markov chain steady state, stability analysis, Google PageRank.',
  },
  svd: {
    summary: 'A = UΣV^T: any matrix factors into rotation × scaling × rotation',
    explanation: 'U (m×m), V (n×n) orthogonal; Σ diagonal with σ₁ ≥ σ₂ ≥ … ≥ 0.\nRank-k approximation: keep top-k singular values → best low-rank approx (Eckart-Young).\nFound: PCA, pseudoinverse, latent semantic analysis, recommender systems.',
  },
  matrix_inverse: {
    summary: 'A^{-1} such that AA^{-1} = I; exists iff det(A) ≠ 0',
    explanation: 'In practice: NEVER compute A^{-1} explicitly — use LU factorization to solve Ax = b.\n2×2: [[d, -b], [-c, a]] / (ad-bc). Condition number κ = σ_max/σ_min measures numerical stability.',
  },
  determinant: {
    summary: 'Scalar measuring the signed volume scaling of the linear transformation A',
    explanation: 'det(A) = 0 ↔ A singular (columns linearly dependent).\ndet(AB) = det(A)·det(B). det(A^T) = det(A). Negative det → reflection.\nFor 2×2: ad − bc. For n×n: cofactor expansion or LU product of pivots.',
  },
  linear_transformations: {
    summary: 'Map T: V → W preserving addition T(u+v)=T(u)+T(v) and scaling T(αv)=αT(v)',
    explanation: 'Every linear map on R^n is matrix multiplication: T(x) = Ax.\nKernel (null space) + Image (column space) characterize the map.\nRank-Nullity: dim(ker T) + dim(im T) = dim(V).',
  },
  orthogonality: {
    summary: 'Two vectors u, v are orthogonal when their dot product u·v = 0',
    explanation: 'Orthonormal basis: {q_i} where q_i·q_j = δ_{ij}.\nQR decomposition: A = QR (via Gram-Schmidt).\nProjection onto subspace W: P = QQ^T. Minimizes distance ||b − Pb||.',
  },
  least_squares: {
    summary: 'Minimizes ||Ax − b||² when the system is overdetermined (more equations than unknowns)',
    explanation: 'Normal equations: A^T Ax = A^T b → x* = (A^T A)^{-1} A^T b.\nGeometrically: projects b onto col(A).\nUsed in linear regression, curve fitting, signal processing.',
  },
  matrix_factorization: {
    summary: 'Decomposing a matrix into a product of simpler matrices (LU, QR, SVD, Cholesky, etc.)',
    explanation: 'LU: A = LU for triangular solve (O(n³)). QR: for least squares & eigenvalues.\nSVD: A = UΣV^T most general. Cholesky: A = LL^T for positive definite.\nChoice depends on problem structure and numerical properties.',
  },
  positive_definite_matrices: {
    summary: 'Symmetric A such that x^T Ax > 0 for all nonzero x',
    explanation: 'Equivalent conditions: all eigenvalues > 0; all leading minors > 0; Cholesky exists.\nArises naturally in covariance matrices, Hessians at minima, Gram matrices K_{ij} = ⟨x_i, x_j⟩.\nPositive semi-definite (PSD): ≥ 0 (allows zero eigenvalues).',
  },
  norm: {
    summary: 'A function ‖·‖ measuring vector magnitude: non-negative, zero iff v=0, homogeneous, triangle inequality',
    explanation: 'L1: Σ|x_i|  L2: √(Σx_i²)  L∞: max|x_i|  Lp: (Σ|x_i|^p)^{1/p}.\nL1 promotes sparsity; L2 is Euclidean distance.\nMatrix norms: Frobenius ‖A‖_F = √(ΣΣa_{ij}²), spectral = σ_max.',
  },
  rank: {
    summary: 'Rank(A) = dimension of the column space = number of linearly independent columns',
    explanation: 'rank(A) + nullity(A) = n (Rank-Nullity theorem). rank(A) = rank(A^T).\nFull rank: rank = min(m,n). Rank-deficient → non-invertible.\nDetermined via row reduction (# pivot positions) or # nonzero singular values.',
  },
  null_space: {
    summary: 'Null(A) = {x : Ax = 0}: the set of all vectors mapped to zero by A',
    explanation: 'dim(Null(A)) = nullity(A) = n − rank(A).\nAx = b has solution iff b ∈ col(A); general solution = particular + null space.\nNull space ⊥ row space. Compute via row reduction of [A | 0].',
  },
  moore_penrose_pseudoinverse: {
    summary: 'A† = V Σ† U^T: generalized inverse giving the least-norm minimum-residual solution',
    explanation: 'For Ax = b: x† = A†b is least-squares solution with minimum norm.\nFull column rank: A† = (A^T A)^{-1}A^T. Full row rank: A† = A^T(AA^T)^{-1}.\nComputed via SVD: Σ†_{ii} = 1/σ_i if σ_i > 0, else 0.',
  },

  // ── PROBABILITY & STATISTICS ──────────────────────────────────
  probability_statistics: {
    summary: 'The mathematics of uncertainty, random phenomena, and inference from data',
    explanation: 'Core concepts: probability distributions, expectation, variance, Bayes theorem.\nFoundation for all of machine learning, signal processing, and scientific inference.',
  },
  random_variables: {
    summary: 'A function X: Ω → R mapping outcomes to real numbers; described by its distribution',
    explanation: 'Discrete: PMF P(X=x). Continuous: PDF f(x), CDF F(x) = P(X≤x).\nE[X] = Σx·P(x) or ∫x·f(x)dx. Var(X) = E[X²] − (E[X])².\nJoint: P(X,Y); marginal by summing/integrating out the other variable.',
  },
  expectation: {
    summary: 'E[X] = Σx·P(x) or ∫x·f(x)dx — the probability-weighted average value',
    explanation: 'Linearity: E[aX+bY] = aE[X] + bE[Y] (always, even if dependent).\nE[g(X)] ≠ g(E[X]) in general (Jensen inequality: equal for linear g).\nE[XY] = E[X]E[Y] only if X, Y independent.',
  },
  variance: {
    summary: 'Var(X) = E[(X−μ)²] = E[X²] − (E[X])² — measures spread around the mean',
    explanation: 'Var(aX+b) = a²Var(X). Var(X+Y) = Var(X)+Var(Y) if X,Y uncorrelated.\nStd dev σ = √Var(X) is in the same units as X.\nSample variance: s² = Σ(x_i−x̄)²/(n−1) (Bessel correction for unbiasedness).',
  },
  bayes_theorem: {
    summary: 'P(A|B) = P(B|A)·P(A) / P(B) — the rule for inverting conditional probabilities',
    explanation: 'Posterior ∝ Likelihood × Prior.\nTotal probability: P(B) = Σ_i P(B|A_i)P(A_i).\nFoundation of Bayesian inference: update prior belief with observed evidence.',
  },
  maximum_likelihood_estimation: {
    summary: 'θ̂_MLE = argmax_θ ∏ p(x_i|θ) — find parameters that make observed data most probable',
    explanation: 'Maximize log-likelihood ℓ(θ) = Σ log p(x_i|θ) (numerically stable, same argmax).\nGaussian: MLE → sample mean and variance. Categorical: MLE → empirical frequencies.\nMLE for classification loss = cross-entropy minimization.',
  },
  conditional_probability: {
    summary: 'P(A|B) = P(A∩B)/P(B) — probability of A given that B is known to have occurred',
    explanation: 'Chain rule: P(A∩B) = P(A|B)·P(B).\nIndependence: P(A|B) = P(A) ↔ P(A∩B) = P(A)P(B).\nConditional expectation E[X|Y] is the foundation of all probabilistic models.',
  },
  probability_distributions: {
    summary: 'A function specifying how probabilities are assigned to outcomes of a random variable',
    explanation: 'Discrete: Bernoulli(p), Binomial(n,p), Poisson(λ), Geometric.\nContinuous: Normal N(μ,σ²), Exponential(λ), Beta, Gamma.\nCharacterized by moments (mean, variance, skewness) and moment-generating function.',
  },
  gaussian_distribution: {
    summary: 'X ~ N(μ, σ²): symmetric bell curve; the most natural distribution by the Central Limit Theorem',
    explanation: 'PDF: (1/σ√2π) exp(−(x−μ)²/2σ²). Standard: Z = (X−μ)/σ ~ N(0,1).\n68-95-99.7 rule: ±1σ, ±2σ, ±3σ cover those percentages.\nMax-entropy distribution for fixed mean and variance.',
  },
  law_of_large_numbers: {
    summary: 'The sample mean X̄_n converges to the true mean μ as n → ∞',
    explanation: 'Weak LLN: P(|X̄_n − μ| > ε) → 0. Strong LLN: X̄_n → μ almost surely.\nRequires finite mean. Basis for Monte Carlo: (1/N)Σf(x_i) → E[f(X)].\nFrequency interpretation of probability: P(A) = lim n(A)/n.',
  },
  central_limit_theorem: {
    summary: '√n(X̄_n − μ)/σ → N(0,1) as n→∞, for i.i.d. samples with finite variance',
    explanation: 'Sum of n i.i.d. RVs → Gaussian regardless of original distribution.\nRequires: finite variance and independence (or weak dependence).\nExplains ubiquity of normal distribution; enables confidence intervals and hypothesis tests.',
  },
  covariance: {
    summary: 'Cov(X,Y) = E[(X−μ_X)(Y−μ_Y)] — measures linear co-variation between two variables',
    explanation: 'Cov(X,X) = Var(X). Correlation ρ = Cov(X,Y)/(σ_X σ_Y) ∈ [−1,1].\nCovariance matrix Σ_{ij} = Cov(X_i, X_j): symmetric, positive semi-definite.\nIndependent → Cov=0, but Cov=0 does NOT imply independence.',
  },
  hypothesis_testing: {
    summary: 'Statistical procedure to decide between null H₀ and alternative H₁ using sample data',
    explanation: 'p-value = P(data at least as extreme | H₀ true). Reject H₀ if p < α.\nType I error: false reject (rate = α). Type II error: false accept (rate = β).\nPower = 1−β. t-test, χ² test, ANOVA are common instances.',
  },
  bayesian_inference: {
    summary: 'Update prior P(θ) with likelihood P(data|θ) → posterior P(θ|data) ∝ P(data|θ)P(θ)',
    explanation: 'Conjugate priors give closed-form posteriors (Beta-Binomial, Normal-Normal).\nMCMC (Metropolis-Hastings, HMC) for intractable posteriors.\nCredible interval: P(θ ∈ CI | data) = 95%, vs frequentist confidence interval.',
  },
  map_estimation: {
    summary: 'θ̂_MAP = argmax P(θ|data) = argmax [log P(data|θ) + log P(θ)] — posterior mode',
    explanation: 'MAP = MLE + log-prior regularizer.\nGaussian prior → L2 regularization (Ridge). Laplace prior → L1 (Lasso).\nPoint estimate: richer information in full posterior, but MAP is faster.',
  },
  markov_chains: {
    summary: 'Stochastic process where the future depends only on the present: P(X_{t+1}|X_t, X_{t-1},…) = P(X_{t+1}|X_t)',
    explanation: 'Transition matrix T where T_{ij} = P(X→j | X=i).\nStationary distribution π: πT = π. Detailed balance: π_i T_{ij} = π_j T_{ji}.\nFoundation of MCMC, RL, Google PageRank, Hidden Markov Models.',
  },

  // ── OPTIMIZATION ──────────────────────────────────────────────
  optimization: {
    summary: 'Finding the minimum (or maximum) of an objective function, possibly subject to constraints',
    explanation: 'Unconstrained: ∇f(x*) = 0 (necessary); H ≻ 0 (sufficient for local min).\nConstrained: KKT conditions generalize this. Convex → local min is global.\nCore of all machine learning: training = solving an optimization problem.',
  },
  gradient_descent: {
    summary: 'θ ← θ − α∇L(θ): iterate in the direction of steepest descent to minimize loss',
    explanation: 'Learning rate α: too large → diverge; too small → slow.\nConvergence: O(1/k) for convex L, O(ρ^k) for strongly convex.\nFull-batch GD uses all data; expensive per step but accurate gradient.',
  },
  convex_optimization: {
    summary: 'Minimize f(x) over convex set C where f satisfies f(λx+(1−λ)y) ≤ λf(x)+(1−λ)f(y)',
    explanation: 'Key property: any local minimum is a global minimum.\nNecessary and sufficient (unconstrained): ∇f(x*) = 0.\nLP, QP, SDP are all convex. Many ML losses are convex (linear regression, logistic regression).',
  },
  lagrange_multipliers: {
    summary: 'Solve constrained min f(x) s.t. g(x)=0 by finding x where ∇f = λ∇g',
    explanation: 'Lagrangian L(x,λ) = f(x) + λg(x). Set ∂L/∂x = 0, ∂L/∂λ = 0.\nλ is the shadow price (marginal cost) of the constraint.\nInequality constraints: KKT conditions (λ ≥ 0, λg(x)=0).',
  },
  duality: {
    summary: 'Primal (min f) ↔ Dual (max g), where g(λ) = min_x L(x,λ); dual provides lower bound',
    explanation: 'Weak duality: d* ≤ p*. Strong duality (Slater\'s condition): d* = p*.\nDual variables = shadow prices of constraints.\nSVM dual: often easier to solve; kernelizes naturally.',
  },
  stochastic_gradient_descent: {
    summary: 'Gradient estimated from a random mini-batch: θ ← θ − α∇L_{batch}(θ)',
    explanation: 'Mini-batch B: B=1 pure SGD, B=N full GD. Noise helps escape sharp minima.\nDecreasing lr schedule (step / cosine / warmup) ensures convergence.\nFaster than full GD per update; often generalizes better.',
  },
  adam_optimizer: {
    summary: 'Adaptive Moment Estimation: per-parameter lr combining momentum (m) and RMSProp (v)',
    explanation: 'm_t = β₁m_{t-1} + (1−β₁)g_t\nv_t = β₂v_{t-1} + (1−β₂)g_t²\nθ ← θ − α·(m̂_t / (√v̂_t + ε))  [bias-corrected]\nTypical: β₁=0.9, β₂=0.999, α=1e-3. Default optimizer for deep learning.',
  },
  learning_rate: {
    summary: 'Scalar α controlling step size in gradient descent: θ ← θ − α∇L',
    explanation: 'Too large → divergence or oscillation. Too small → slow convergence.\nSchedules: step decay, cosine annealing, warmup then decay.\nAdaptive methods (Adam, RMSProp) tune α per-parameter automatically.',
  },
  momentum: {
    summary: 'Accumulate past gradients: v ← βv − α∇L, θ ← θ + v — accelerates training',
    explanation: 'Physical analogy: ball rolling downhill, building speed. β ≈ 0.9.\nReduces oscillations in high-curvature ravines; accelerates in low-curvature directions.\nNesterov momentum: compute gradient at the lookahead position → faster convergence.',
  },
  loss_function: {
    summary: 'L(ŷ, y): scalar measure of discrepancy between prediction ŷ and true label y',
    explanation: 'Regression: MSE = (1/n)Σ(y−ŷ)², MAE = (1/n)Σ|y−ŷ|.\nClassification: cross-entropy = −Σy·log(ŷ). Hinge (SVM): max(0, 1−y·f(x)).\nChoice of loss determines what optimal prediction means.',
  },
  cross_entropy_loss: {
    summary: 'L = −Σ y_i log p_i: measures divergence between true labels y and predicted probabilities p',
    explanation: 'Binary: L = −[y log p + (1−y) log(1−p)].\nMinimizing cross-entropy ≡ maximizing log-likelihood (MLE).\nNumerically: use log-softmax + NLLLoss (LogSumExp trick avoids overflow).',
  },
  l1_regularization: {
    summary: 'Add λ‖w‖₁ = λΣ|w_i| to loss — promotes sparsity by driving small weights to exactly zero',
    explanation: 'Non-smooth at 0; sub-gradient or proximal operator needed.\nProximal (soft-threshold): S_λ(w_i) = sign(w_i)·max(|w_i|−λ, 0).\nLasso regression uses L1. MAP equivalent: Laplace prior. Good for feature selection.',
  },
  l2_regularization: {
    summary: 'Add λ‖w‖₂² = λΣw_i² to loss (weight decay) — shrinks weights toward zero smoothly',
    explanation: 'Gradient of penalty: 2λw → update: w ← (1−2αλ)w − α∇L (weight decay).\nMAP with Gaussian prior N(0, 1/2λ). Closed-form Ridge: β̂ = (X^T X + λI)^{-1}X^T y.\nWeights never exactly zero (unlike L1); prefers small but non-sparse solutions.',
  },
  newton_method: {
    summary: "Second-order optimization: x_{k+1} = x_k − H^{-1}∇f — uses curvature for faster convergence",
    explanation: 'Quadratic convergence near optimum (vs. linear for GD).\nCost: O(n²) store H, O(n³) invert per step — prohibitive for large n.\nQuasi-Newton (L-BFGS): approximate H^{-1} using gradient history. Used in logistic regression.',
  },
  kkt_conditions: {
    summary: 'Necessary optimality conditions for constrained optimization: stationarity, feasibility, complementary slackness',
    explanation: '∇f(x*) + Σλ_i∇g_i + Σν_j∇h_j = 0  (stationarity)\nλ_i ≥ 0  (dual feasibility)\ng_i(x*) ≤ 0  (primal feasibility)\nλ_i g_i(x*) = 0  (complementary slackness)\nSufficient for convex problems.',
  },

  // ── CALCULUS ──────────────────────────────────────────────────
  calculus: {
    summary: 'The mathematics of continuous change: differentiation (rates) and integration (accumulation)',
    explanation: 'Fundamental Theorem: differentiation and integration are inverse operations.\nKey for gradient computation, probability density integration, and change-of-variables.',
  },
  partial_derivatives: {
    summary: '∂f/∂x_i: rate of change of f w.r.t. x_i, holding all other variables constant',
    explanation: 'Gradient ∇f = [∂f/∂x_1, …, ∂f/∂x_n].\nSecond partials ∂²f/∂x_i∂x_j form the Hessian matrix.\nClairaut\'s theorem: mixed partials are equal when continuous.',
  },
  chain_rule: {
    summary: 'd/dx f(g(x)) = f\'(g(x))·g\'(x) — the fundamental rule for differentiating compositions',
    explanation: 'Multivariate: ∂z/∂t = Σ_i (∂z/∂x_i)(∂x_i/∂t).\nBackpropagation IS the chain rule applied recursively on computational graphs.\nEssential for every gradient computation in deep learning.',
  },
  taylor_expansion: {
    summary: 'Polynomial approximation of f near x₀: f(x) ≈ f(x₀) + f\'(x₀)(x−x₀) + f\'\'(x₀)(x−x₀)²/2! + …',
    explanation: 'Error of degree-n approximation: O((x−x₀)^{n+1}).\nNewton\'s method uses 2nd-order Taylor: x_{k+1} = x_k − H^{-1}∇f.\nKey expansions: e^x = Σx^n/n!, sin x = x − x³/6 + …',
  },
  gradient: {
    summary: '∇f(x) = [∂f/∂x_1, …, ∂f/∂x_n]^T — vector pointing in the direction of steepest ascent',
    explanation: '‖∇f‖ = rate of steepest ascent. Gradient descent: move in −∇f.\nNecessary condition for min/max: ∇f = 0.\nMatrix calculus: ∂(Ax)/∂x = A^T, ∂(x^T Ax)/∂x = 2Ax (symmetric A).',
  },
  jacobian: {
    summary: 'J_{ij} = ∂f_i/∂x_j: matrix of all first-order partial derivatives of a vector-valued function',
    explanation: '|det(J)| = local volume scaling (change of variables in integration).\nf: R^n → R^m → J is m×n.\nRobotics: end-effector velocity = J · joint velocity. Critical for backprop through vector layers.',
  },
  hessian: {
    summary: 'H_{ij} = ∂²f/(∂x_i ∂x_j): symmetric matrix of all second-order partial derivatives',
    explanation: 'H ≻ 0 ↔ strict local minimum. H ≺ 0 ↔ maximum. Indefinite → saddle point.\nNewton\'s method: x_{k+1} = x_k − H^{-1}∇f.\nExpensive: O(n²) storage, O(n³) invert. Quasi-Newton approximates it.',
  },
  integration: {
    summary: '∫f(x)dx: continuous summation — computes area under a curve or total accumulation',
    explanation: 'FTC: d/dx ∫_a^x f(t)dt = f(x).\nGaussian integral: ∫_{-∞}^{∞} e^{-x²}dx = √π.\nIn ML: computing expectations E[f(X)] = ∫f(x)p(x)dx; normalizing distributions.',
  },
  multivariable_calculus: {
    summary: 'Calculus extended to functions of multiple variables: gradients, Jacobians, Hessians, multiple integrals',
    explanation: 'Gradient, divergence, curl unify classical physics (Maxwell\'s equations).\nStokes\' theorem generalizes the Fundamental Theorem of Calculus.\nKey for optimization (∇f=0), density estimation (∫f=1), and backpropagation.',
  },

  // ── ALGORITHMS ────────────────────────────────────────────────
  algorithms: {
    summary: 'Step-by-step computational procedures that solve problems with guaranteed correctness and efficiency',
    explanation: 'Analyze: time complexity T(n), space complexity S(n), correctness proof.\nDesign paradigms: divide-and-conquer, dynamic programming, greedy, backtracking.',
  },
  sorting: {
    summary: 'Arrange elements in order; comparison-based lower bound is Ω(n log n)',
    explanation: 'Merge sort: O(n log n) stable, O(n) space. Quicksort: O(n log n) avg, O(n²) worst.\nHeapsort: O(n log n) in-place. Counting/Radix: O(n) for bounded-range integers.\nIn-place vs. stable vs. parallelizable are key tradeoffs.',
  },
  dynamic_programming: {
    summary: 'Solve overlapping subproblems once and cache results to avoid redundant computation',
    explanation: 'Requires: optimal substructure + overlapping subproblems.\nTop-down: memoize recursive calls. Bottom-up: fill table iteratively.\nExamples: LCS O(mn), 0/1 knapsack O(nW), shortest paths (Bellman-Ford, Floyd-Warshall).',
  },
  graph_algorithms: {
    summary: 'Algorithms operating on graphs G=(V,E): traversal, shortest paths, spanning trees, connectivity',
    explanation: 'BFS: shortest path unweighted, O(V+E). DFS: cycle detection, topological sort.\nDijkstra: shortest path non-negative weights O((V+E)logV).\nBellman-Ford: handles negative edges O(VE). Floyd-Warshall: all-pairs O(V³).',
  },
  greedy_algorithms: {
    summary: 'Make the locally optimal choice at each step, achieving a global optimum when the greedy property holds',
    explanation: 'Works when: greedy-choice property + optimal substructure.\nExamples that work: Huffman coding, Prim\'s/Kruskal\'s MST, activity selection, fractional knapsack.\nDoesNOT always work: 0/1 knapsack, coin change with arbitrary denominations.',
  },
  divide_and_conquer: {
    summary: 'Split into sub-problems, solve recursively, combine: T(n) = aT(n/b) + f(n)',
    explanation: 'Master theorem: T(n) = Θ(n^{log_b a}) if f(n) = O(n^{log_b a − ε}).\nExamples: merge sort T(n) = 2T(n/2)+O(n) = O(n log n). Strassen: O(n^{2.81}).\nNaturally parallelizable. Basis of FFT: O(n log n) vs O(n²) DFT.',
  },
  binary_search: {
    summary: 'Find target in sorted array in O(log n) by repeatedly halving the search space',
    explanation: 'Invariant: target ∈ [lo, hi]. Mid = lo + (hi−lo)//2 (avoids overflow).\nGeneralizes: find first x satisfying any monotone predicate.\nApplications: search in sorted array, square root, minimize convex function on integers.',
  },
  bfs: {
    summary: 'Explore graph level by level using a FIFO queue; finds shortest unweighted paths',
    explanation: 'O(V+E). Mark visited to avoid revisits.\nBFS tree gives shortest-hop paths from source s.\nAlso: detects cycles (undirected), finds connected components, tests bipartiteness.',
  },
  dfs: {
    summary: 'Explore as deep as possible before backtracking using recursion or an explicit stack',
    explanation: 'O(V+E). Discovery/finish timestamps reveal graph structure.\nEdge types: tree, back, forward, cross edges (directed DFS).\nApplications: topological sort, SCC (Kosaraju/Tarjan), cycle detection, maze solving.',
  },
  dijkstra: {
    summary: 'Single-source shortest paths for graphs with non-negative edge weights using a priority queue',
    explanation: 'Greedy: repeatedly extract minimum-distance unvisited vertex.\nO((V+E) log V) with binary heap; O(V log V + E) with Fibonacci heap.\nFails for negative edge weights → use Bellman-Ford.',
  },
  backtracking: {
    summary: 'Systematically search all candidates; abandon a partial solution as soon as it violates constraints',
    explanation: 'DFS + constraint-pruning. Incremental construction with feasibility check at each step.\nExamples: N-Queens, Sudoku, subset-sum, permutations.\nPruning efficiency determines practical performance; often exponential worst-case.',
  },

  // ── DATA STRUCTURES ───────────────────────────────────────────
  data_structures: {
    summary: 'Ways to organize and store data for efficient access, insertion, deletion, and modification',
    explanation: 'Core tradeoff: time vs. space, access patterns vs. update frequency.\nChoose based on operations needed: search, insert, delete, order, range queries.',
  },
  trees: {
    summary: 'Connected acyclic graph with one root; each node has a parent (except root) and zero or more children',
    explanation: 'Height-h binary tree has ≤ 2^h leaves. BST: O(h) search/insert/delete.\nBalanced (AVL, Red-Black): O(log n) guaranteed. B-tree: minimizes disk I/O (page-aware).\nIn-order traversal of BST gives sorted sequence.',
  },
  hash_tables: {
    summary: 'Map keys to values via a hash function; expected O(1) insert, lookup, and delete',
    explanation: 'Load factor α = n/m. Collision: chaining (linked lists) or open addressing (probing).\nUniversal hashing: E[collisions per key] = O(α). Resize at α > 0.7.\nWorst case O(n), but expected O(1) with good hash function.',
  },
  heaps: {
    summary: 'Complete binary tree satisfying the heap property: parent ≥ children (max-heap) or parent ≤ children (min-heap)',
    explanation: 'Insert: O(log n) sift-up. Extract-max: O(log n) sift-down. Build-heap: O(n).\nStored in array: children of node i are 2i+1 and 2i+2 (1-indexed).\nPriority queue implementation. Heapsort: O(n log n), in-place.',
  },
  graphs_ds: {
    summary: 'G = (V, E): vertices connected by edges; directed or undirected, weighted or unweighted',
    explanation: 'Adjacency matrix: O(1) edge check, O(V²) space → dense graphs.\nAdjacency list: O(degree) traversal, O(V+E) space → sparse graphs.\nDAG (directed acyclic graph): key for dependencies, topological ordering.',
  },
  linked_lists: {
    summary: 'Linear sequence of nodes, each containing data and a pointer to the next node',
    explanation: 'O(1) insert/delete with pointer, O(n) search (no random access).\nDoubly linked: O(1) delete with node reference. Singly: O(1) prepend.\nUsed in hash table chaining, LRU cache, undo history.',
  },
  stacks_queues: {
    summary: 'Stack (LIFO): push/pop from top. Queue (FIFO): enqueue at back, dequeue from front. Both O(1)',
    explanation: 'Stack applications: DFS, call frames, bracket matching, undo/redo.\nQueue applications: BFS, scheduling, producer-consumer.\nDeque: O(1) at both ends. Priority queue: ordered by priority (heap-backed).',
  },
  binary_search_tree: {
    summary: 'BST: left subtree < node < right subtree; enables O(h) search, insert, delete',
    explanation: 'In-order traversal gives sorted sequence. Successor = leftmost of right subtree.\nHeight h = O(log n) balanced, O(n) degenerate. Self-balancing: AVL, Red-Black O(log n).\nAVL: |height_L − height_R| ≤ 1 at every node.',
  },
  trie: {
    summary: 'Prefix tree where each path from root to leaf spells a key; O(L) operations, L = key length',
    explanation: 'Space: O(ALPHABET_SIZE × L × N). All operations: O(L).\nApplications: autocomplete, spell check, IP routing, dictionary.\nCompressed trie (Patricia tree) merges single-child nodes to save space.',
  },

  // ── COMPLEXITY THEORY ─────────────────────────────────────────
  complexity_theory: {
    summary: 'The study of computational resources (time, space) required to solve problems',
    explanation: 'Classifies problems by inherent difficulty, independent of implementation.\nKey classes: P, NP, NP-complete, NP-hard, PSPACE, EXP.',
  },
  big_o_notation: {
    summary: 'f(n) = O(g(n)): f grows no faster than c·g(n) for large n — asymptotic upper bound',
    explanation: 'O: upper, Ω: lower, Θ: tight, o: strict upper, ω: strict lower.\nHierarchy: O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2^n) < O(n!).\nAlways analyze worst-case unless stated otherwise.',
  },
  p_vs_np: {
    summary: 'P: solvable in polynomial time. NP: verifiable in polynomial time. Is P = NP? Unknown.',
    explanation: 'P ⊆ NP. Most believe P ≠ NP (Millennium Prize Problem, $1M).\nIf P = NP: modern cryptography (RSA, AES) collapses; AI and optimization become trivial.\nNP-hard ≥ hardest NP problems in difficulty (may not be in NP themselves).',
  },
  np_completeness: {
    summary: 'NP-complete: a problem that is both in NP and NP-hard (hardest problems in NP)',
    explanation: 'Show NP-complete: prove in NP + reduce from known NP-complete problem.\nFirst proven: CIRCUIT-SAT (Cook-Levin, 1971). Classic examples: 3-SAT, Clique, Vertex Cover, TSP, Knapsack.\nSolve any NP-complete in polynomial time → P = NP.',
  },
  time_complexity: {
    summary: 'How algorithm runtime grows as a function of input size n',
    explanation: 'Count primitive operations, not wall-clock seconds.\nCommon complexities: O(log n) binary search, O(n) scan, O(n log n) merge sort, O(n²) nested loops.\nWorst-case vs average-case can differ dramatically (quicksort O(n log n) avg, O(n²) worst).',
  },
  space_complexity: {
    summary: 'How algorithm memory usage grows as a function of input size n',
    explanation: 'Auxiliary space excludes input. O(1): in-place. O(n): linear extra. O(n²): matrix.\nRecursion stack depth = O(depth). Memoization: O(states) space for O(states) time.\nSpace-time tradeoff: hash table gives O(1) time at O(n) space cost.',
  },

  // ── SUPERVISED LEARNING ───────────────────────────────────────
  supervised_learning: {
    summary: 'Learn a mapping f: X → Y from labeled training examples (x_i, y_i) pairs',
    explanation: 'Goal: minimize expected loss on unseen data (generalization).\nKey concepts: overfitting, bias-variance tradeoff, cross-validation.\nAlgorithms: linear/logistic regression, SVM, trees, neural networks.',
  },
  linear_regression: {
    summary: 'Fit a hyperplane y = Xβ + ε to minimize squared error ‖y − Xβ‖²',
    explanation: 'Closed form: β̂ = (X^T X)^{-1}X^T y (normal equations).\nAssumes: linear relationship, i.i.d. Gaussian errors, no multicollinearity.\nR² = 1 − SS_res/SS_tot measures fraction of variance explained.',
  },
  logistic_regression: {
    summary: 'Binary classifier: P(y=1|x) = σ(w^T x + b), trained via cross-entropy loss',
    explanation: 'Log-odds (logit) = w^T x + b is linear. Decision boundary: w^T x + b = 0.\nNo closed form; solved via gradient descent (or Newton). Output is a probability.\nExtends to softmax regression for multi-class classification.',
  },
  svm: {
    summary: 'Find the maximum-margin hyperplane: maximize 2/‖w‖ s.t. y_i(w^T x_i + b) ≥ 1',
    explanation: 'Support vectors: training points on the margin. Dual is often easier to solve.\nSoft margin: allow violations with slack ξ_i, penalty C. C controls bias-variance.\nKernel trick: replace x^T x → K(x,x\') for non-linear boundaries (RBF, polynomial).',
  },
  knn: {
    summary: 'Classify by majority vote of k nearest neighbors; no training phase (lazy learner)',
    explanation: 'Distance metric: Euclidean, Manhattan, cosine. k controls bias-variance:\nSmall k → low bias, high variance. Large k → high bias, low variance.\nCurse of dimensionality: distances become indistinguishable in high-D.',
  },
  decision_tree: {
    summary: 'Recursively split feature space to minimize impurity (Gini or information gain)',
    explanation: 'Gini(S) = 1 − Σ p_i². Entropy H(S) = −Σ p_i log p_i.\nIG = H(parent) − Σ (|child|/|parent|) H(child).\nDepth controls complexity. Prone to overfitting; prune or use ensemble.',
  },
  random_forest: {
    summary: 'Ensemble of decision trees, each on a bootstrap sample with random feature subsets; average predictions',
    explanation: 'Reduces variance via bagging (bootstrap aggregating), not bias.\nFeature subsampling: typically √n_features per split (classification).\nOut-of-bag (OOB) error: free validation estimate. Feature importance via impurity decrease.',
  },
  gradient_boosting: {
    summary: 'Sequentially fit shallow trees to negative gradients (residuals) of the current ensemble',
    explanation: 'F_t(x) = F_{t-1}(x) + α h_t(x) where h_t fits −∂L/∂F_{t-1}.\nLearning rate α shrinks each tree\'s contribution (regularization).\nXGBoost: 2nd-order Taylor + L1/L2 on tree weights. LightGBM: leaf-wise growth.',
  },
  naive_bayes: {
    summary: 'Classify using Bayes\' theorem + conditional independence assumption: P(y|x) ∝ P(y)·∏ P(x_i|y)',
    explanation: 'Naive = features are independent given y (strong, often violated assumption).\nGaussian NB for continuous; Bernoulli/Multinomial for text.\nFast training, good for high-dimensional sparse data (spam detection, NLP).',
  },
  overfitting: {
    summary: 'Model memorizes training noise: low training error but high test error',
    explanation: 'Detected by training–validation accuracy gap.\nFix: more data, regularization (L1/L2), dropout, early stopping, simpler model, cross-validation.\nUnderfitting: high bias, model too simple. Regularization trades bias↑ for variance↓.',
  },
  cross_validation: {
    summary: 'Estimate generalization by training/evaluating on multiple train/validation splits',
    explanation: 'K-fold: split into K folds; train on K−1, validate on 1; average K scores.\nStratified K-fold preserves class ratios. LOOCV: K=n, unbiased but expensive.\nAlways use for hyperparameter selection; never use test set for this.',
  },
  feature_engineering: {
    summary: 'Transform raw inputs into informative features to improve model performance',
    explanation: 'Normalization: z-score (μ=0,σ=1) or min-max ([0,1]).\nEncoding: one-hot for nominal, ordinal for ordered categoricals.\nTransformations: log for skewed data, polynomial features for interactions. PCA for compression.',
  },
  ensemble_methods: {
    summary: 'Combine multiple models to reduce error: bagging (variance↓), boosting (bias↓), stacking',
    explanation: 'Bagging: train independently on bootstrap samples, average (Random Forest).\nBoosting: sequential, each model focuses on previous errors (Gradient Boosting, AdaBoost).\nStacking: use model predictions as features for a meta-learner. Diversity among models is key.',
  },
  ridge_regression: {
    summary: 'Linear regression with L2 penalty: min ‖y − Xβ‖² + λ‖β‖²',
    explanation: 'Closed form: β̂ = (X^T X + λI)^{-1}X^T y — always invertible due to λI.\nShrinks coefficients toward zero but not to exactly zero.\nMAP with Gaussian prior N(0, 1/2λ). Cross-validate to select λ.',
  },
  lasso_regression: {
    summary: 'Linear regression with L1 penalty: min ‖y − Xβ‖² + λ‖β‖₁ — induces sparsity',
    explanation: 'L1 penalty creates corners at 0 → many β_i = exactly 0 (automatic feature selection).\nNo closed form; solved via coordinate descent or proximal gradient.\nMAP with Laplace prior. Elastic net = L1 + L2.',
  },
  roc_auc: {
    summary: 'ROC: plot TPR vs FPR at all thresholds; AUC = P(score(positive) > score(negative))',
    explanation: 'TPR (recall) = TP/(TP+FN). FPR = FP/(FP+TN).\nAUC = 1: perfect. AUC = 0.5: random. Threshold-independent.\nPrefer PR curve over ROC-AUC when class imbalance is severe.',
  },
  precision_recall: {
    summary: 'Precision = TP/(TP+FP): how many positives are correct. Recall = TP/(TP+FN): how many positives are found',
    explanation: 'F1 = 2·(P·R)/(P+R): harmonic mean balancing precision and recall.\nHigh threshold → high precision, low recall. PR tradeoff visualized in PR curve.\nUse when positive class is rare or false positives and false negatives have very different costs.',
  },
  class_imbalance: {
    summary: 'Training data has heavily skewed class distribution; majority class dominates naive accuracy',
    explanation: 'Fixes: oversampling minority (SMOTE), undersampling majority, class-weighted loss.\nMetrics: use F1, AUC-PR instead of accuracy.\nClassifier biased toward majority without correction.',
  },
  xgboost: {
    summary: 'Extreme Gradient Boosting: regularized gradient boosting with 2nd-order Taylor expansion',
    explanation: 'Split gain = ½[G_L²/(H_L+λ) + G_R²/(H_R+λ) − (G_L+G_R)²/(H_L+H_R+λ)] − γ.\nHandles missing values natively. Shrinkage η and column subsampling regularize.\nState-of-art for tabular data. LightGBM: leaf-wise growth for speed.',
  },

  // ── UNSUPERVISED LEARNING ─────────────────────────────────────
  unsupervised_learning: {
    summary: 'Discover hidden structure in unlabeled data: clusters, latent factors, density, manifolds',
    explanation: 'Goal: find compact representations or natural groupings without supervision.\nAlgorithms: k-means, PCA, GMM, autoencoders, t-SNE, UMAP.',
  },
  k_means: {
    summary: 'Partition n points into k clusters by iterating: assign to nearest centroid → update centroids',
    explanation: 'Objective: minimize within-cluster sum of squares (WCSS = Σ_i Σ_{x∈C_i} ‖x − μ_i‖²).\nConverges to local minimum. k-means++ initialization for better results.\nElbow method for k selection. Assumes spherical clusters; sensitive to outliers.',
  },
  pca: {
    summary: 'Project data to directions of maximum variance; top eigenvectors of the covariance matrix',
    explanation: 'Cov = X^T X / n. Top-k eigenvectors = principal components.\nEquivalent via SVD: X = UΣV^T — top-k columns of V.\nVariance retained by PC_i = σ_i² / Σσ_j². Whitening: divide scores by σ_i.',
  },
  gaussian_mixture_models: {
    summary: 'Model data as a mixture of K Gaussians: P(x) = Σ_k π_k N(x; μ_k, Σ_k)',
    explanation: 'Soft clustering: each point has responsibility r_{ik} = P(z=k|x_i).\nTrain via EM: E-step computes r_{ik}, M-step updates π_k, μ_k, Σ_k.\nMore flexible than k-means (arbitrary covariance). AIC/BIC for selecting K.',
  },
  dbscan: {
    summary: 'Density-based clustering: expand clusters from core points (≥ MinPts within ε-neighborhood)',
    explanation: 'Core point: ≥ MinPts within ε. Border: reachable from core. Noise: isolated.\nFinds arbitrarily shaped clusters. Does not require K.\nSensitive to ε and MinPts. Fails with varying density.',
  },
  hierarchical_clustering: {
    summary: 'Build a dendrogram by iteratively merging (agglomerative) or splitting (divisive) clusters',
    explanation: 'Agglomerative: start with n singleton clusters; merge closest at each step.\nLinkage criteria: single (min dist), complete (max dist), average, Ward (min variance increase).\nCut dendrogram at chosen height to get flat clustering.',
  },
  em_algorithm: {
    summary: 'Expectation-Maximization: iteratively compute expected log-likelihood (E), then maximize (M)',
    explanation: 'E-step: compute Q(θ|θ_old) = E_Z[log P(X,Z|θ) | X, θ_old].\nM-step: θ_new = argmax_θ Q.\nGuaranteed to (weakly) increase log-likelihood each iteration. Converges to local max.\nApplications: GMM, HMM, missing data imputation.',
  },
  dimensionality_reduction: {
    summary: 'Reduce feature count while preserving important structure (variance, distances, topology)',
    explanation: 'Linear: PCA (variance), LDA (class separation), ICA (independence).\nNon-linear: t-SNE, UMAP (local structure), autoencoders (reconstruction).\nCurse of dimensionality: in high-D, distances concentrate → nearest neighbor fails.',
  },
  autoencoder: {
    summary: 'Neural network trained to reconstruct input through a low-dimensional bottleneck',
    explanation: 'Encoder f: R^d → R^k (k < d) → bottleneck (latent code z) → Decoder g: R^k → R^d.\nLoss: ‖x − g(f(x))‖². Learns compressed representation end-to-end.\nDenoising AE: reconstruct clean x from corrupted x̃. VAE: adds distributional constraint on z.',
  },
  t_sne: {
    summary: 'Non-linear dimensionality reduction preserving local neighborhoods; used to visualize high-D data in 2D/3D',
    explanation: 'High-D similarities: Gaussian kernel. Low-D similarities: Student-t (heavy tails to prevent crowding).\nMinimize KL(P_high || Q_low) via gradient descent.\nHyperparameters: perplexity (5–50), learning rate. Non-deterministic; distances between clusters not meaningful.',
  },
  umap: {
    summary: 'UMAP: Uniform Manifold Approximation — fast non-linear dimensionality reduction preserving global + local structure',
    explanation: 'Based on Riemannian geometry and algebraic topology. Faster than t-SNE at scale.\nPreserves more global structure than t-SNE. Use for exploration and as preprocessing for downstream tasks.\nHyperparameters: n_neighbors, min_dist.',
  },
  anomaly_detection: {
    summary: 'Identify data points that deviate significantly from the expected pattern (outliers)',
    explanation: 'Methods: isolation forest, one-class SVM, autoencoders (high reconstruction error), DBSCAN noise points.\nApplications: fraud detection, network intrusion, manufacturing defects.\nChallenge: rare by definition → limited labeled examples; evaluation is hard.',
  },
  isolation_forest: {
    summary: 'Anomaly detection via random feature-split trees; anomalies are isolated in fewer splits',
    explanation: 'Randomly select a feature and split value; repeat recursively.\nAnomaly score = average path length to isolate a point (shorter = more anomalous).\nO(n log n) training; efficient for high-dimensional data. No distance computation needed.',
  },
  self_supervised_learning: {
    summary: 'Learn representations from unlabeled data using pretext tasks with automatically generated labels',
    explanation: 'Pretext tasks: masked prediction (BERT), contrastive pairs (SimCLR), rotation prediction.\nNo human annotation needed → scale to massive unlabeled datasets.\nRepresentations transfer well to downstream tasks with few labeled examples.',
  },
  contrastive_learning: {
    summary: 'Learn representations by pulling similar (positive) pairs together and pushing dissimilar (negative) pairs apart',
    explanation: 'SimCLR InfoNCE: −log[exp(sim(z_i,z_j)/τ) / Σ_k exp(sim(z_i,z_k)/τ)].\nPositive pairs: two augmented views of the same image. Negatives: other examples in batch.\nTemperature τ controls concentration. CLIP: contrastive image-text pairs at scale.',
  },

  // ── REINFORCEMENT LEARNING ────────────────────────────────────
  reinforcement_learning: {
    summary: 'Learn to act by maximizing cumulative reward through trial-and-error interaction with an environment',
    explanation: 'Agent observes state s, takes action a, receives reward r, transitions to s\'.\nGoal: find policy π*(a|s) maximizing E[Σ γ^t r_t].\nMethods: DP (model-based), TD learning, policy gradients, Q-learning.',
  },
  mdp: {
    summary: 'Markov Decision Process (S, A, P, R, γ): the formal framework for sequential decision making',
    explanation: 'S: state space. A: actions. P(s\'|s,a): transition. R(s,a): reward. γ: discount.\nPolicy π(a|s): action distribution. Value V^π(s) = E[Σ γ^t r_t | s_0=s, π].\nGoal: find π* maximizing V^π*(s) for all s.',
  },
  bellman_equation: {
    summary: 'V*(s) = max_a [R(s,a) + γ Σ P(s\'|s,a) V*(s\')]: the recursive optimality condition',
    explanation: 'Decomposes value into immediate reward + discounted future value.\nQ*(s,a) = R(s,a) + γ Σ P(s\'|s,a) max_{a\'} Q*(s\',a\').\nValue Iteration: repeatedly apply Bellman operator until convergence. Foundation of all RL.',
  },
  q_learning: {
    summary: 'Off-policy TD: Q(s,a) ← Q(s,a) + α[r + γ max_{a\'} Q(s\',a\') − Q(s,a)]',
    explanation: 'Target = r + γ max Q(s\',·). Off-policy: learns Q* regardless of behavior policy.\nTD error δ_t = r + γQ(s\') − Q(s) is the learning signal.\nDQN: approximate Q with a neural network + experience replay + target network.',
  },
  policy_gradient: {
    summary: 'Directly optimize policy π_θ by ascending the gradient of expected return J(θ)',
    explanation: 'REINFORCE: ∇J(θ) = E[∇log π_θ(a|s)·G_t]. High variance.\nBaseline b(s): subtract to reduce variance (advantage = G_t − b(s)).\nActor-critic: b(s) = V(s). PPO clips importance ratio for stable training.',
  },
  value_function: {
    summary: 'V^π(s) = E[Σ γ^t r_t | s_0=s, π] — expected cumulative discounted return from state s',
    explanation: 'Action-value Q(s,a) = R(s,a) + γ E[V(s\')].\nAdvantage A(s,a) = Q(s,a) − V(s): quality of action relative to average.\nLearned via TD methods (bootstrapped) or Monte Carlo (full episodes).',
  },
  exploration_exploitation: {
    summary: 'Exploit known high-reward actions vs. explore unknowns to potentially find better ones',
    explanation: 'ε-greedy: random action with probability ε. Decay ε over training.\nUCB: add bonus √(log t / N(a)) — "optimism in face of uncertainty".\nThompson Sampling: sample from posterior. Multi-armed bandit: simplest RL setting.',
  },
  temporal_difference: {
    summary: 'Update value estimates using bootstrapped targets without waiting for episode end',
    explanation: 'TD(0): V(s) ← V(s) + α[r + γV(s\') − V(s)]. δ = r + γV(s\') − V(s) is the TD error.\nAdvantage: online learning, works for continuing tasks, lower variance than MC.\nTD(λ): eligibility traces blend TD(0) and Monte Carlo via parameter λ ∈ [0,1].',
  },
  actor_critic: {
    summary: 'Actor π_θ selects actions; Critic V_φ estimates values to provide advantage baseline',
    explanation: 'Actor gradient: ∇_θ J ≈ ∇_θ log π_θ(a|s)·(r + γV_φ(s\') − V_φ(s)).\nCritic: update V_φ via TD error. More stable than pure policy gradient.\nModern variants: A3C (asynchronous), PPO (clipped ratio), SAC (entropy regularization).',
  },

  // ── DEEP LEARNING ─────────────────────────────────────────────
  deep_learning: {
    summary: 'Multi-layer neural networks that learn hierarchical representations from raw data',
    explanation: 'Depth enables compositionality: early layers = edges, mid = shapes, late = objects.\nTrained end-to-end via backpropagation + gradient descent.\nKey innovations: ReLU, dropout, batch norm, residual connections, attention.',
  },
  neural_networks: {
    summary: 'Compositions of linear layers + nonlinear activations: output = σ(W_L σ(…σ(W_1 x + b_1)…) + b_L)',
    explanation: 'Universal approximation: single hidden layer with enough neurons approximates any continuous function.\nDepth provides hierarchical feature learning efficiently.\nTrained via backpropagation; requires differentiable activations.',
  },
  backpropagation: {
    summary: 'Efficient computation of all gradients ∂L/∂w via the chain rule on the computational graph',
    explanation: 'Forward pass: compute activations, cache intermediates.\nBackward pass: δ_l = (W_{l+1}^T δ_{l+1}) ⊙ σ\'(z_l); ∂L/∂W_l = δ_l · a_{l-1}^T.\nSame computational cost as one forward pass (O(parameters)).',
  },
  cnn: {
    summary: 'Shared convolutional filters learn spatially local patterns; efficient for images via weight sharing',
    explanation: '(I * K)[i,j] = Σ_{p,q} K[p,q]·I[i+p, j+q]. Output size: (W−F+2P)/S+1.\nInductive biases: translation invariance (pooling) and local connectivity.\nArchitecture: Conv → ReLU → Pool → … → FC. Basis of ResNet, VGG, EfficientNet.',
  },
  rnn: {
    summary: 'h_t = σ(W_h h_{t-1} + W_x x_t + b): recurrent cell processes sequences step by step',
    explanation: 'Hidden state h_t carries sequential memory. Trained via BPTT (backprop through time).\nVanishing gradient: gradients shrink as ∂h_t/∂h_{t-k} → 0 over long sequences.\nGating (LSTM, GRU) solves this. RNN replaced by Transformers for most NLP.',
  },
  lstm: {
    summary: 'LSTM gating (forget f, input i, output o) allows cell state c_t to carry long-term memory',
    explanation: 'f_t = σ(W_f [h_{t-1}, x_t] + b_f)   (what to forget)\ni_t = σ(W_i [h_{t-1}, x_t] + b_i)   (what to write)\nc_t = f_t * c_{t-1} + i_t * tanh(W_c [h_{t-1}, x_t] + b_c)\nh_t = o_t * tanh(c_t)\nGRU: simplified 2-gate variant, fewer parameters.',
  },
  transformer: {
    summary: 'Self-attention + feed-forward layers; fully parallelizable, captures long-range dependencies',
    explanation: 'Attention(Q,K,V) = softmax(QK^T/√d_k)V. Multi-head runs h parallel heads.\nPositional encoding adds order information (sinusoidal or learned).\nEncoder-decoder for seq2seq; decoder-only (GPT) for generation. O(n²) in sequence length.',
  },
  attention_mechanism: {
    summary: 'Compute a weighted combination of values V based on query-key similarity scores',
    explanation: 'score(Q,K) = QK^T/√d_k. Attention weights α = softmax(scores).\nOutput = αV. Self-attention: Q=K=V from same sequence.\nCross-attention: Q from decoder, K,V from encoder. Foundation of Transformer.',
  },
  regularization: {
    summary: 'Techniques to prevent overfitting by constraining model capacity or adding noise',
    explanation: 'L2 (weight decay): λ‖w‖² → smooth, non-sparse. L1: λ‖w‖₁ → sparse.\nDropout: random zeroing. Data augmentation. Early stopping. Label smoothing.\nAll reduce variance at the cost of slight bias increase.',
  },
  batch_normalization: {
    summary: 'Normalize layer activations to zero mean/unit variance then rescale: BN(x) = γ·(x−μ)/σ + β',
    explanation: 'Statistics μ, σ computed over mini-batch during training; running stats at inference.\nEnables higher learning rates, reduces sensitivity to initialization.\nLayerNorm: normalize over features per-sample (preferred in Transformers).',
  },
  dropout: {
    summary: 'Randomly zero each neuron with probability p during training; scale by 1/(1−p) at test time',
    explanation: 'Prevents co-adaptation: neurons cannot rely on specific other neurons.\nEquivalent to training an ensemble of 2^n sub-networks (exponential in # neurons).\nInverted dropout: scale at train time → no modification at test time. p=0.5 hidden, 0.1 input.',
  },
  activation_functions: {
    summary: 'Non-linear function applied after linear layer; essential for learning non-linear mappings',
    explanation: 'Without non-linearity: deep network ≡ single linear layer (no expressive power gain).\nKey functions: ReLU (most common), sigmoid (output binary), tanh (centered), GELU (Transformers).\nMust be differentiable (almost everywhere) for gradient-based training.',
  },
  relu: {
    summary: 'f(x) = max(0, x): zero for negative inputs, identity for positive — simple and widely used',
    explanation: 'Gradient: 1 if x>0, 0 if x≤0. No saturation for positive values → no vanishing gradient.\nDead ReLU: if pre-activation always ≤ 0, neuron never updates.\nFix: Leaky ReLU (0.01x for x<0), ELU, PReLU (learned slope).',
  },
  sigmoid: {
    summary: 'σ(x) = 1/(1+e^{-x}) ∈ (0,1): maps any real number to a probability',
    explanation: 'Derivative: σ(x)(1−σ(x)) ≤ 0.25 — saturates at extremes → vanishing gradients.\nUse in output layer for binary classification (paired with BCE loss).\nAvoid in hidden layers (use ReLU). σ(−x) = 1 − σ(x).',
  },
  softmax: {
    summary: 'softmax(z)_i = e^{z_i} / Σ_j e^{z_j}: normalizes logits to a probability distribution',
    explanation: 'Output of multi-class classifier. Temperature T: softmax(z/T) — T→0: argmax, T→∞: uniform.\nNumerically stable: subtract max(z) first (log-sum-exp trick).\nlog-softmax + NLLLoss = cross-entropy in PyTorch.',
  },
  weight_initialization: {
    summary: 'Initial weight values critically affect training dynamics; symmetry breaking is essential',
    explanation: 'Zero init: all neurons learn identical features (symmetry problem) → avoid.\nXavier/Glorot (tanh): Var(w) = 2/(n_in + n_out).\nHe/Kaiming (ReLU): Var(w) = 2/n_in.\nOrthogonal initialization: good for RNNs.',
  },
  vanishing_gradient: {
    summary: 'Gradients shrink exponentially through layers, making early layers learn extremely slowly',
    explanation: 'Cause: sigmoid derivative ≤ 0.25 — multiply L times → (0.25)^L ≈ 0.\nFix: ReLU activations, residual connections, LSTM gating, batch normalization.\nExploding gradients: clip gradient norm (‖g‖ > threshold → g = g·threshold/‖g‖).',
  },
  residual_connections: {
    summary: 'Skip connections add input directly to output: y = F(x) + x (ResNet)',
    explanation: 'Gradient flows directly through identity shortcut: ∂L/∂x = ∂L/∂y·(1 + ∂F/∂x).\nKey insight: learn residual F(x) = H(x)−x (easier to push F→0 than H→identity).\nEnables training of 100+ layer networks. Used in ResNet, Transformer (pre/post-LN).',
  },
  gan: {
    summary: 'Generator G produces fakes; Discriminator D distinguishes real vs. fake — minimax game',
    explanation: 'min_G max_D E[log D(x)] + E[log(1−D(G(z)))].\nNash equilibrium: G(z) ~ P_data, D(x) = 0.5 everywhere.\nChallenges: mode collapse, training instability. WGAN uses Wasserstein distance for stability.',
  },
  vae: {
    summary: 'Variational Autoencoder: encoder → (μ,σ) latent; decoder reconstructs; trained via ELBO',
    explanation: 'ELBO = E_{q_φ(z|x)}[log p_θ(x|z)] − KL(q_φ(z|x) ‖ p(z)).\nReparameterization: z = μ + σ·ε, ε~N(0,I) — enables backprop through sampling.\nSmooth latent space → interpolation, generation. Lower quality than GAN, but stable training.',
  },
  transfer_learning: {
    summary: 'Reuse a model pre-trained on a large dataset for a different but related task',
    explanation: 'Feature extraction: freeze base, train only new head (fast, few data).\nFine-tuning: update all weights on new task with small lr.\nImageNet features transfer broadly to vision. BERT/GPT for NLP. Domain adaptation handles distribution shift.',
  },
  fine_tuning: {
    summary: 'Adapt a pre-trained model by continuing training on task-specific data, typically with a small learning rate',
    explanation: 'Learning rate: 10–100× smaller than pre-training (avoid destroying learned features).\nStrategies: freeze early layers (generic), unfreeze later (task-specific).\nCatastrophic forgetting: model loses pre-training knowledge. LoRA: fine-tune low-rank matrix updates only.',
  },
  embeddings: {
    summary: 'Dense low-dimensional vector representations of discrete objects (words, items, categories)',
    explanation: 'Learned end-to-end or separately. Similar objects cluster in embedding space.\nWord embeddings: distributional semantics — king − man + woman ≈ queen (Word2Vec, GloVe).\nItem embeddings: collaborative filtering. Graph embeddings: Node2Vec. Typical dim: 64–1024.',
  },
  word2vec: {
    summary: 'Train a shallow neural net on word context prediction to produce dense word embeddings',
    explanation: 'CBOW: predict center word from context. Skip-gram: predict context from center.\nObjective: maximize P(context | word) via softmax over vocabulary.\nKey property: analogies via vector arithmetic. Basis for all modern NLP embeddings.',
  },
  positional_encoding: {
    summary: 'Add position-dependent vectors to embeddings; Transformers have no inherent sequence order',
    explanation: 'Sinusoidal: PE(pos, 2i) = sin(pos/10000^{2i/d}); PE(pos, 2i+1) = cos(…).\nUnique per position; relative positions computable via dot product.\nRoPE (Rotary): encodes relative positions in attention directly → better length generalization.',
  },
  multi_head_attention: {
    summary: 'Run h parallel attention heads on different linear projections; concatenate and project',
    explanation: 'Each head: Attention(QW_i^Q, KW_i^K, VW_i^V).\nConcat all h heads → multiply by W^O.\nDifferent heads capture different relationships (syntax, semantics, long-range). h typically 8–16; d_head = d_model/h.',
  },
  layer_normalization: {
    summary: 'Normalize activations across features per sample: LN(x) = γ(x−μ)/σ + β',
    explanation: 'Statistics computed over feature dimension (not batch dimension like BatchNorm).\nNo batch-size dependency; stable with small batches and RNNs.\nPre-LN (before attention/FFN) more stable than Post-LN for deep Transformers.',
  },
  bert: {
    summary: 'Bidirectional Encoder pre-trained on Masked LM + NSP; fine-tuned for downstream NLP tasks',
    explanation: 'MLM: predict 15% masked tokens (80% → [MASK], 10% → random, 10% → unchanged).\nNSP: predict if sentence B follows sentence A (removed in RoBERTa).\n[CLS] token for classification. Bidirectional context: better than GPT for understanding tasks.',
  },
  gpt: {
    summary: 'Autoregressive decoder pre-trained on next-token prediction; excels at generation and in-context learning',
    explanation: 'Causal (left-to-right) attention: each token attends only to previous tokens.\nPre-trained on next-token prediction (language modeling) at scale.\nIn-context learning: provide examples in prompt — no gradient update needed.\nGPT-3: 175B parameters. GPT-4: multimodal.',
  },
  diffusion_models: {
    summary: 'Generate data by learning to reverse a gradual Gaussian noise process over T steps',
    explanation: 'Forward: q(x_t|x_0) = N(√ᾱ_t x_0, (1−ᾱ_t)I). Adds noise over T steps.\nReverse: learn ε_θ(x_t, t) to predict the noise added.\nLoss: L = E[‖ε − ε_θ(x_t, t)‖²]. Stable training; slow sampling (DDIM speeds it up).',
  },
  mlp: {
    summary: 'Multi-Layer Perceptron: stack of fully-connected layers with nonlinear activations',
    explanation: 'Layer l: a^l = σ(W^l a^{l-1} + b^l). Universal approximation with sufficient width.\nNo parameter sharing (unlike CNNs) → large parameter count for high-D inputs.\nBaseline architecture for tabular data; used as feed-forward sublayer in Transformers.',
  },
  convolution: {
    summary: 'Sliding dot product of a learned filter over the input — detects local patterns regardless of position',
    explanation: 'Output size: (W − F + 2P)/S + 1 (W=input, F=filter, P=padding, S=stride).\nParameter sharing: same filter weights at every position → translational invariance.\nDepthwise separable convolution (MobileNet) reduces parameters by ~8-9×.',
  },
  pooling: {
    summary: 'Spatial downsampling to reduce feature map size and add translation invariance',
    explanation: 'Max pooling: take max in each window (most common). Average pooling: take mean.\nGlobal average pooling: reduce each feature map to one scalar (replaces large FC layers).\nStride ≥ 2 in convolution is an alternative to explicit pooling.',
  },
  self_attention: {
    summary: 'Attention where queries, keys, and values all come from the same sequence — each position attends to all others',
    explanation: 'output = softmax(QK^T/√d_k) V, Q=K=V = X W.\nCaptured all-pairs interactions: O(n²d) complexity.\nCausal mask (−∞ above diagonal) for autoregressive decoding.\nFoundation of Transformer encoder and decoder.',
  },
  masked_language_modeling: {
    summary: 'Pre-training task: mask ~15% of tokens; predict them given full bidirectional context',
    explanation: 'Masking strategy: 80% [MASK], 10% random token, 10% original.\nForces model to use both left and right context → bidirectional representations.\nBERT: trained on MLM + NSP. RoBERTa: more data, no NSP. SpanBERT: masks spans.',
  },
  instruction_tuning: {
    summary: 'Fine-tune a pre-trained LLM on (instruction, response) pairs to follow natural language instructions',
    explanation: 'FLAN: fine-tuned on 100+ tasks phrased as instructions → better zero-shot generalization.\nInstructGPT / ChatGPT: instruction tuning + RLHF for human-preferred responses.\nKey insight: data quality and diversity > raw quantity for instruction following.',
  },
  rlhf: {
    summary: 'RLHF: fine-tune an LLM using human preference rankings via a reward model and PPO',
    explanation: 'Step 1: supervised fine-tuning on human demonstrations.\nStep 2: train reward model on human preference rankings.\nStep 3: optimize LLM with PPO against reward model + KL penalty (prevents reward hacking).\nPowers InstructGPT, ChatGPT, Claude.',
  },
  parameter_efficient_finetuning: {
    summary: 'Fine-tune only a small number of additional parameters while keeping most of the pre-trained model frozen',
    explanation: 'LoRA: add low-rank matrices ΔW = BA (r ≪ d). Only A,B are trained. Merge at inference.\nAdapters: small bottleneck layers inserted between existing layers.\nPrefix tuning: optimize soft prompt tokens prepended to input.\nReduces GPU memory and training time dramatically.',
  },

  // ── THEORETICAL ML ────────────────────────────────────────────
  theoretical_ml: {
    summary: 'Mathematical foundations of ML: generalization, complexity, information theory, learnability',
    explanation: 'Key questions: when can we learn? How much data is needed? What is the fundamental limit?\nTools: PAC learning, VC dimension, Rademacher complexity, information theory.',
  },
  vc_dimension: {
    summary: 'VC(H): max number of points that hypothesis class H can shatter (correctly classify all 2^n labelings)',
    explanation: 'Higher VC dim → more expressive, but needs more data to generalize.\nGeneralization bound: err ≤ train_err + O(√(d·log(n/d)/n)).\nLinear classifiers in R^d: VC = d+1. Infinite VC → may not PAC-learn.',
  },
  pac_learning: {
    summary: 'PAC: Probably Approximately Correct — with probability ≥ 1−δ, learn hypothesis with error ≤ ε',
    explanation: 'Sample complexity: n ≥ (1/ε)(log|H| + log(1/δ)) for finite H.\nAgnostic PAC: no realizable assumption; bound includes best-in-H error.\nVC dimension generalizes PAC to infinite hypothesis classes.',
  },
  bias_variance_tradeoff: {
    summary: 'MSE = Bias² + Variance + Noise; complex models lower bias but raise variance',
    explanation: 'Bias = E[f̂(x)] − f(x): systematic error from wrong model assumptions.\nVariance = E[(f̂ − E[f̂])²]: sensitivity to training data fluctuations.\nRegularization increases bias to reduce variance. Cross-validation selects the optimal tradeoff.',
  },
  information_theory: {
    summary: 'Quantifies information, uncertainty, and communication limits using entropy and divergence',
    explanation: 'Entropy H(X) = −Σ p log p. Mutual information I(X;Y) = H(X) − H(X|Y).\nChannel capacity C = max_p I(X;Y) (Shannon, 1948).\nKL divergence, cross-entropy, rate-distortion theory underpin all of ML theory.',
  },
  kl_divergence: {
    summary: 'KL(P‖Q) = Σ P(x) log[P(x)/Q(x)] ≥ 0: information lost when using Q to approximate P',
    explanation: 'Non-negative (Gibbs inequality); equals 0 iff P = Q. NOT symmetric.\nForward KL (P‖Q): zero-avoiding; Reverse KL (Q‖P): zero-forcing.\nELBO = E[log p(x|z)] − KL(q(z|x)‖p(z)). Fundamental in VAE, information geometry.',
  },
  mutual_information: {
    summary: 'I(X;Y) = H(X) − H(X|Y): reduction in uncertainty about X when Y is observed',
    explanation: 'Symmetric: I(X;Y) = I(Y;X). Zero iff X,Y independent.\nI(X;Y) = KL(P_{XY} ‖ P_X P_Y) = Σ P(x,y) log[P(x,y)/(P(x)P(y))].\nFeature selection: pick features maximizing I(X;label). Upper-bounded by channel capacity.',
  },
  entropy: {
    summary: 'H(X) = −Σ p(x) log₂ p(x) bits: average surprise / uncertainty in a random variable',
    explanation: 'Max entropy: uniform distribution H = log₂|X|. Zero entropy: deterministic.\nBinary entropy: H(p) = −p log p − (1−p) log(1−p), max at p = 0.5 (1 bit).\nCross-entropy H(p,q) = H(p) + KL(p‖q). Used directly as loss in classification.',
  },
  no_free_lunch: {
    summary: 'No single algorithm outperforms all others when averaged over all possible problems',
    explanation: 'Formal: Σ_f L(a₁,f) = Σ_f L(a₂,f) for any two algorithms a₁, a₂.\nImplication: performance depends on how well inductive bias matches the problem structure.\nJustifies why domain knowledge, feature engineering, and model selection matter.',
  },
  empirical_risk_minimization: {
    summary: 'Learn by minimizing the average loss on training data: min_{h∈H} (1/n) Σ L(h(x_i), y_i)',
    explanation: 'ERM is consistent: converges to Bayes optimal as n→∞ under realizability.\nGeneralization gap: |ERM risk − true risk| bounded by Rademacher complexity or VC dim.\nFoundation of statistical learning theory and PAC learning.',
  },
  rademacher_complexity: {
    summary: 'Measures the capacity of a hypothesis class by how well it fits random ±1 noise labels',
    explanation: 'R_n(H) = E_σ[sup_{h∈H} (1/n) Σ σ_i h(x_i)], σ_i ∈ {±1} i.i.d.\nGeneralization bound: err ≤ train_err + 2R_n(H) + O(√(log(1/δ)/n)).\nData-dependent; tighter than VC dim for structured problems.',
  },
  generalization_bounds: {
    summary: 'Upper bounds on the gap between training error and true (population) error',
    explanation: 'Uniform convergence: P(sup_{h∈H}|R(h)−R̂(h)| > ε) ≤ δ.\nTools: VC dim, Rademacher complexity, PAC-Bayes bounds.\nKey insight: larger hypothesis class → looser bound; need data to "earn" complexity.',
  },
  statistical_learning_theory: {
    summary: 'Mathematical framework analyzing when and how fast learning algorithms generalize',
    explanation: 'Core questions: (1) Is H learnable? (2) How many samples? (3) Which algorithm?\nPAC framework, VC theory, Rademacher complexity are main tools.\nBridge between empirical ML practice and theoretical guarantees.',
  },

  // ── LINEAR ALGEBRA (missing entries) ─────────────────────────
  column_space: {
    summary: 'col(A): the set of all vectors Ax that A can produce — the image of the linear map',
    explanation: 'col(A) = span of columns of A. dim(col(A)) = rank(A).\nAx = b has a solution iff b ∈ col(A).\nProjection onto col(A): P = A(A^T A)^{-1} A^T (used in least squares).',
  },
  change_of_basis: {
    summary: 'Rewrite vectors / matrices in a different coordinate system via an invertible matrix P',
    explanation: 'If P = [b₁ | … | bₙ] (new basis as columns), then [v]_B = P^{-1} v.\nMatrix in new basis: A_B = P^{-1} A P (similarity transform).\nChoosing eigenvectors as basis diagonalizes A: P^{-1}AP = D.',
  },
  projection_matrix: {
    summary: 'P² = P: idempotent matrix that projects any vector onto a fixed subspace',
    explanation: 'Orthogonal projection onto col(A): P = A(A^T A)^{-1} A^T, symmetric and idempotent.\nI − P projects onto the orthogonal complement.\nUsed in least squares (project b onto col(A)), PCA, and Gram-Schmidt.',
  },
  orthonormal_basis: {
    summary: 'Basis {q₁,…,qₙ} where qᵢ·qⱼ = δᵢⱼ (pairwise orthogonal and unit-length vectors)',
    explanation: 'If Q = [q₁|…|qₙ], then Q^T Q = I (orthogonal matrix: Q^T = Q^{-1}).\nCoordinates easy: [v]_Q = Q^T v. Projection: Pv = QQ^T v.\nGram-Schmidt: build orthonormal basis from any linearly independent set.',
  },
  spectral_theorem: {
    summary: 'Every real symmetric matrix A = QΛQ^T has real eigenvalues and orthogonal eigenvectors',
    explanation: 'Q is orthogonal, Λ = diag(λ₁,…,λₙ). Decomposition is unique (up to sign/order).\nPositive semidefinite ↔ all λᵢ ≥ 0. PD ↔ all λᵢ > 0.\nFoundation for PCA (cov matrix is symmetric), kernel methods, quadratic forms.',
  },

  // ── PROBABILITY & STATISTICS (missing entries) ────────────────
  bernoulli_distribution: {
    summary: 'Models a single binary trial: P(X=1) = p, P(X=0) = 1−p',
    explanation: 'E[X] = p. Var(X) = p(1−p). Max variance at p = 0.5.\nBuilding block for Binomial. Log-likelihood for logistic regression is Bernoulli log-likelihood.\nEntropy: H = −p log p − (1−p) log(1−p).',
  },
  binomial_distribution: {
    summary: 'X ~ Bin(n,p): number of successes in n independent Bernoulli(p) trials',
    explanation: 'P(X=k) = C(n,k) pᵏ (1−p)^{n−k}. E[X] = np. Var(X) = np(1−p).\nApproximations: Normal N(np, np(1−p)) for large n; Poisson(np) when n large, p small.\nUsed in A/B testing, quality control, click-through models.',
  },
  poisson_distribution: {
    summary: 'X ~ Poisson(λ): models rare event counts in a fixed interval when rate = λ',
    explanation: 'P(X=k) = e^{-λ} λᵏ / k!. E[X] = Var(X) = λ (mean = variance — key identifier).\nLimit of Bin(n,p) as n→∞, p→0, np→λ.\nUsed for: server requests, typos per page, radioactive decay counts.',
  },
  exponential_distribution: {
    summary: 'X ~ Exp(λ): models waiting time between Poisson events; P(X>t) = e^{-λt}',
    explanation: 'PDF: f(x) = λe^{-λx}. E[X] = 1/λ. Var(X) = 1/λ².\nMemoryless property: P(X > s+t | X > s) = P(X > t). Unique continuous memoryless distribution.\nUsed in reliability, queuing theory, survival analysis.',
  },
  sampling_methods: {
    summary: 'Techniques to draw samples from distributions: inverse CDF, rejection, MCMC, importance sampling',
    explanation: 'Inverse CDF: if F is the CDF, then F^{-1}(U) ~ target for U ~ Uniform.\nRejection sampling: sample from proposal, accept with prob f(x)/(M·g(x)).\nMCMC (Metropolis-Hastings, Gibbs): build Markov chain with target as stationary distribution.\nImportance sampling: estimate E_p[f] = E_q[f(x)p(x)/q(x)] — vital in RL and Bayesian inference.',
  },
  monte_carlo_methods: {
    summary: 'Estimate expectations using random samples: E[f(X)] ≈ (1/N) Σ f(xᵢ), xᵢ ~ p',
    explanation: 'Error ∝ 1/√N (CLT) regardless of dimension — beats numerical quadrature in high-D.\nVariance reduction: importance sampling, control variates, antithetic variables.\nMonte Carlo integration, MCMC, policy gradient estimation, stochastic simulation all rely on this.',
  },
  confidence_interval: {
    summary: 'A range [L, U] such that P(θ ∈ [L,U]) ≥ 1−α over repeated sampling (frequentist)',
    explanation: '95% CI for mean: x̄ ± 1.96 σ/√n (large n, CLT).\nMisinterpretation: NOT "95% chance θ is in this interval" — θ is fixed, interval is random.\nWider CI → less data or more variance. Used in A/B testing, polling, clinical trials.',
  },
  a_b_testing: {
    summary: 'Randomized controlled experiment comparing metric of two variants (A = control, B = treatment)',
    explanation: 'Null H₀: μ_A = μ_B. Reject if p-value < α (typically 0.05).\nTwo-sample t-test or z-test; minimum sample size: n ≈ (z_α + z_β)² · 2σ² / δ².\nPitfalls: peeking (inflates false positive rate), novelty effect, network effects.',
  },

  // ── OPTIMIZATION (missing entries) ────────────────────────────
  constrained_optimization: {
    summary: 'min f(x) subject to g(x) ≤ 0, h(x) = 0: optimize with equality and inequality constraints',
    explanation: 'KKT conditions (necessary): ∇f + Σλᵢ∇gᵢ + Σμⱼ∇hⱼ = 0, λᵢ ≥ 0, λᵢgᵢ = 0.\nLagrangian: L(x,λ,μ) = f(x) + λᵀg(x) + μᵀh(x).\nConvex problems: KKT sufficient; strong duality (Slater). Underlies SVMs, LP, QP.',
  },
  projected_gradient_descent: {
    summary: 'Gradient descent step followed by projection back onto the feasible set C',
    explanation: 'Update: x_{t+1} = Π_C(x_t − α∇f(x_t)).\nΠ_C(y) = argmin_{x∈C} ‖x − y‖ (closest point in C).\nFor L-smooth f, converges at O(1/t). Used in SVMs, non-negative matrix factorization, lasso.',
  },
  line_search: {
    summary: 'Procedure to choose step size α in gradient descent: find α that sufficiently decreases f',
    explanation: 'Exact: α* = argmin_α f(x − α∇f(x)). Expensive; used in quasi-Newton.\nArmijo (sufficient decrease): f(x − αg) ≤ f(x) − c₁α‖g‖².\nWolfe conditions add curvature condition. Backtracking: start large, halve until Armijo holds.',
  },
  proximal_gradient: {
    summary: 'Splits objective into smooth f + non-smooth g: prox step handles g exactly',
    explanation: 'Update: x_{t+1} = prox_{αg}(x_t − α∇f(x_t)).\nprox_g(v) = argmin_x [g(x) + (1/2α)‖x − v‖²].\nLasso: prox of λ‖·‖₁ is soft-thresholding. Enables sparse/non-smooth optimization at gradient cost.',
  },

  // ── CALCULUS (missing entries) ─────────────────────────────────
  limits: {
    summary: 'lim_{x→a} f(x) = L: f(x) approaches L as x approaches a, regardless of f(a)',
    explanation: 'ε-δ definition: ∀ε>0 ∃δ>0: 0<|x−a|<δ ⟹ |f(x)−L|<ε.\nL\'Hôpital: if 0/0 or ∞/∞, lim f/g = lim f\'/g\'.\nLimits underpin derivatives, integrals, and continuity — the foundation of all analysis.',
  },
  continuity: {
    summary: 'f continuous at a iff lim_{x→a} f(x) = f(a): no jumps, holes, or asymptotes',
    explanation: 'Types: removable discontinuity (hole), jump discontinuity, infinite discontinuity.\nExtreme Value Theorem: f continuous on [a,b] → attains max and min.\nLipschitz continuity |f(x)−f(y)| ≤ L|x−y| guarantees convergence of gradient descent.',
  },
  multivariate_chain_rule: {
    summary: '∂f/∂t = Σᵢ (∂f/∂xᵢ)(∂xᵢ/∂t): chain rule generalized to functions of multiple variables',
    explanation: 'Matrix form: df/dt = (∇_x f)^T · (dx/dt) = Jacobian × velocity.\nFor neural nets: backpropagation IS the multivariate chain rule applied recursively.\nKey: partial derivatives compose along every path in the computation graph.',
  },
  directional_derivative: {
    summary: 'D_u f(x) = ∇f(x)·û: rate of change of f at x in direction unit vector û',
    explanation: 'Maximum directional derivative is |∇f| in direction ∇f/|∇f| (gradient direction).\nZero directional derivative → û perpendicular to ∇f (level set tangent).\nFoundation: gradient descent moves in the direction of steepest decrease −∇f.',
  },
  implicit_function_theorem: {
    summary: 'If F(x,y)=0 and ∂F/∂y ≠ 0, then y is locally a function of x with dy/dx = −(∂F/∂x)/(∂F/∂y)',
    explanation: 'Generalizes to F: R^{n+m} → R^m; gives conditions for implicit definition of m variables.\nUsed to differentiate through constraints (Lagrange multipliers, implicit layers in DL).\nImplicit differentiation in optimization: how optimal solution changes with parameters.',
  },
  jacobian_determinant: {
    summary: 'det(J_F): scales volume under transformation F: R^n → R^n (change of variables in integrals)',
    explanation: 'Change of variables: ∫f(y)dy = ∫f(F(x))|det J_F(x)|dx.\nFor F linear: J_F = A, det J_F = det(A) (volume scaling factor).\nUsed in normalizing flows (bijective neural nets modeling densities), physics simulations.',
  },

  // ── ALGORITHMS (missing entries) ──────────────────────────────
  shortest_path_algorithms: {
    summary: 'Find minimum-weight path between nodes: Dijkstra (non-neg weights), Bellman-Ford, A*',
    explanation: 'Dijkstra: O((V+E) log V) with min-heap; greedy, requires non-negative weights.\nBellman-Ford: O(VE), handles negative weights, detects negative cycles.\nA*: Dijkstra + heuristic h(v) ≤ true cost; optimal if h is admissible (never overestimates).\nUsed in GPS routing, network flow, game AI pathfinding.',
  },
  minimum_spanning_tree: {
    summary: 'Minimum-weight connected subgraph spanning all V vertices: Kruskal\'s or Prim\'s algorithm',
    explanation: 'Kruskal: sort edges, add if no cycle (Union-Find) → O(E log E).\nPrim: grow tree greedily from a vertex, pick min-weight crossing edge → O(E log V).\nCut property: lightest edge crossing any cut belongs to some MST.\nUsed in network design, clustering (single-linkage), approximate TSP.',
  },

  // ── REINFORCEMENT LEARNING (missing entries) ──────────────────
  reward_shaping: {
    summary: 'Add auxiliary rewards F(s,a,s\') to the original reward to speed up learning without changing optimal policy',
    explanation: 'Potential-based shaping: F(s,a,s\') = γΦ(s\') − Φ(s). Preserves optimal policy (policy invariance theorem).\nWrong shaping can cause reward hacking (agent optimizes shaped reward instead of true reward).\nUsed in sparse-reward envs: dense signal guides early exploration.',
  },

  // ── EXPANSION SET (graph node coverage) ───────────────────────
  mathematics: {
    summary: 'Formal study of patterns, structure, quantity, and change using logic and proof',
    explanation: 'Core pillars: algebra, analysis, geometry, probability, and discrete math.\nProvides the language for algorithms, optimization, and modeling in science and ML.\nProofs establish correctness and limits of what can be computed or inferred.',
  },
  computer_science: {
    summary: 'Study of computation, algorithms, and information processes in hardware and software',
    explanation: 'Key areas: algorithms, data structures, systems, theory of computation, and AI.\nFocus on efficiency (time/space), correctness, and scalability.\nBridges math with practical engineering constraints.',
  },
  machine_learning: {
    summary: 'Algorithms that learn patterns from data to make predictions or decisions',
    explanation: 'Supervised, unsupervised, and reinforcement learning are core paradigms.\nTraining = optimize a loss function; generalization = perform well on new data.\nBias-variance tradeoff governs model complexity and data needs.',
  },
  artificial_intelligence: {
    summary: 'Systems that perform tasks requiring human-like intelligence: reasoning, perception, planning',
    explanation: 'Modern AI is dominated by ML, but also includes search, logic, and planning.\nSymbolic AI: rules and knowledge graphs. Statistical AI: probabilistic models and data.\nCurrent frontier: large-scale foundation models and agentic systems.',
  },
  topological_sort: {
    summary: 'Ordering of nodes in a DAG such that all edges u→v place u before v',
    explanation: 'Only defined for DAGs. Detects cycles if ordering fails.\nKahn\'s algorithm: repeatedly remove nodes with in-degree 0.\nUsed for build systems, scheduling, dependency resolution.',
  },
  floyd_warshall: {
    summary: 'All-pairs shortest paths via dynamic programming in O(V^3)',
    explanation: 'Update rule: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]).\nHandles negative edges but not negative cycles (can detect them).\nGood for dense graphs or small V.',
  },
  bellman_ford: {
    summary: 'Single-source shortest paths that supports negative edge weights',
    explanation: 'Relax all edges V−1 times; if a further relaxation is possible, a negative cycle exists.\nTime complexity O(VE). Slower than Dijkstra but more general.\nUsed in routing protocols (e.g., distance-vector).',
  },
  union_find: {
    summary: 'Disjoint Set Union (DSU) structure for dynamic connectivity',
    explanation: 'Supports find(x) and union(x,y). Path compression + union by rank gives near O(1) amortized.\nCore for Kruskal\'s MST, connectivity queries, and clustering.',
  },
  disjoint_set: {
    summary: 'Partition elements into disjoint sets with efficient union/find operations',
    explanation: 'Same as Union-Find (DSU). Find gives set representative.\nPath compression flattens trees; union by size/rank keeps them shallow.',
  },
  amortized_analysis: {
    summary: 'Average cost per operation over a sequence, even if some operations are expensive',
    explanation: 'Accounts for occasional costly steps (e.g., dynamic array resizing).\nMethods: aggregate, accounting, and potential.\nGives tighter bounds than worst-case for many data structures.',
  },
  string_matching: {
    summary: 'Find occurrences of a pattern in a text efficiently',
    explanation: 'Naive: O(nm). KMP: O(n+m) using prefix function.\nRabin-Karp: rolling hash (probabilistic). Boyer-Moore: practical fast with heuristics.\nUsed in search engines, DNA sequence matching, and editors.',
  },
  priority_queue: {
    summary: 'Data structure supporting extract-min/max and insert efficiently',
    explanation: 'Binary heap: O(log n) insert/extract, O(1) peek.\nFibonacci heap: better theoretical decrease-key; useful in some graph algorithms.\nBackbone for Dijkstra and A*.',
  },
  segment_tree: {
    summary: 'Tree supporting range queries and point updates in O(log n)',
    explanation: 'Stores aggregate info (sum, min, max) per segment.\nBuild O(n), query/update O(log n).\nUsed in competitive programming and real-time analytics.',
  },
  fenwick_tree: {
    summary: 'Binary Indexed Tree for prefix sums and point updates in O(log n)',
    explanation: 'Smaller constant than segment tree; supports sum(1..i) and update(i, delta).\nCan be extended to range updates with tricks.',
  },
  b_tree: {
    summary: 'Balanced multi-way search tree optimized for disks and databases',
    explanation: 'Each node stores multiple keys and children; high fan-out reduces disk I/O.\nB+ tree stores all data in leaves; internal nodes are routing only.\nUsed in databases and filesystems.',
  },
  bloom_filter: {
    summary: 'Space-efficient probabilistic set membership: may yield false positives, never false negatives',
    explanation: 'k hash functions set bits in a bit array. Query checks if all bits set.\nFalse positive rate increases as set grows; no deletions without counting variant.\nUsed in caches, databases, and networking.',
  },
  adjacency_list: {
    summary: 'Graph representation storing for each vertex a list of its neighbors',
    explanation: 'Space O(V+E). Efficient for sparse graphs.\nTraversal time proportional to degree; great for BFS/DFS.',
  },
  reduction: {
    summary: 'Transform one problem into another to transfer hardness or solvability',
    explanation: 'If A reduces to B, then solving B solves A.\nUsed to prove NP-hardness and design algorithms via known solutions.',
  },
  polynomial_time: {
    summary: 'An algorithm runs in time O(n^k) for some constant k',
    explanation: 'Considered efficient/tractable in complexity theory.\nClass P = problems solvable in polynomial time by deterministic Turing machine.',
  },
  nondeterminism: {
    summary: 'Computation model that can explore multiple choices simultaneously',
    explanation: 'Nondeterministic TM accepts if any computation path accepts.\nClass NP: problems verifiable in polynomial time (equivalently solvable by NDTM in poly time).',
  },
  decision_problem: {
    summary: 'Problem with a yes/no answer (language membership)',
    explanation: 'Complexity classes (P, NP, co-NP) are defined over decision problems.\nMany optimization problems have related decision versions.',
  },
  approximation_algorithms: {
    summary: 'Algorithms that produce near-optimal solutions with guarantees',
    explanation: 'Approx ratio: solution ≤ α * optimal (or ≥ 1/α for maximization).\nUsed for NP-hard problems like TSP, set cover, and scheduling.',
  },
  randomized_algorithms: {
    summary: 'Algorithms that use randomness to simplify logic or improve expected performance',
    explanation: 'Las Vegas: always correct, random runtime. Monte Carlo: fixed runtime, small error.\nRandomness can avoid worst-case inputs and simplify proofs.',
  },
  hyperparameter_tuning: {
    summary: 'Search over model/config parameters not learned during training',
    explanation: 'Methods: grid search, random search, Bayesian optimization.\nUse validation set or cross-validation to avoid overfitting.\nAutomated tuning can dominate manual trial-and-error.',
  },
  probability_calibration: {
    summary: 'Adjust predicted probabilities so they match observed frequencies',
    explanation: 'Calibrated model: among predictions of 0.8, ~80% are correct.\nMethods: Platt scaling, isotonic regression, temperature scaling.\nImportant for decision-making and risk-sensitive systems.',
  },
  spectral_clustering: {
    summary: 'Cluster data using eigenvectors of a similarity (graph Laplacian) matrix',
    explanation: 'Build affinity graph, compute Laplacian L, use top-k eigenvectors.\nCaptures non-convex clusters better than k-means.\nRequires careful choice of similarity kernel.',
  },
  latent_variable_models: {
    summary: 'Models with unobserved variables that explain observed data',
    explanation: 'Examples: Gaussian mixtures, HMMs, topic models.\nInference via EM, variational inference, or MCMC.\nUseful for discovery and representation learning.',
  },
  manifold_learning: {
    summary: 'Assume data lies on a low-dimensional manifold embedded in high-dimensional space',
    explanation: 'Algorithms: Isomap, LLE, t-SNE, UMAP.\nUsed for visualization and nonlinear dimensionality reduction.',
  },
  sarsa: {
    summary: 'On-policy TD control: Q(s,a) ← Q(s,a) + α[r + γQ(s\',a\') − Q(s,a)]',
    explanation: 'Uses the action actually taken a\' (policy-following).\nStable and conservative compared to off-policy methods like Q-learning.',
  },
  epsilon_greedy: {
    summary: 'Exploration strategy: with prob ε choose random action, else exploit best action',
    explanation: 'Simple and effective; ε can decay over time.\nBalances exploration vs exploitation.',
  },
  policy_iteration: {
    summary: 'Solve MDP by alternating policy evaluation and policy improvement',
    explanation: 'Evaluate V^π, then update π to be greedy w.r.t. V^π.\nConverges to optimal policy for finite MDPs.',
  },
  value_iteration: {
    summary: 'Iteratively apply Bellman optimality update to values',
    explanation: 'V_{k+1}(s) = max_a [R(s,a) + γ Σ P(s\'|s,a) V_k(s\')].\nConverges to optimal value function; derive policy greedily.',
  },
  model_based_rl: {
    summary: 'RL approach that learns or uses a model of environment dynamics',
    explanation: 'Plan with the model (e.g., Dyna) to improve data efficiency.\nRisk: model bias; remedy with uncertainty and re-planning.',
  },
  off_policy_learning: {
    summary: 'Learn a target policy from data generated by a different behavior policy',
    explanation: 'Allows learning from logs or replay buffers.\nImportance sampling corrects distribution mismatch; can increase variance.',
  },
  on_policy_learning: {
    summary: 'Learn from trajectories generated by the current policy',
    explanation: 'Stable but sample-inefficient. Examples: SARSA, policy gradients.\nImproves smoothly but requires fresh data after policy changes.',
  },
  sequence_modeling: {
    summary: 'Model temporal or ordered data with dependence across steps',
    explanation: 'Models: RNN, LSTM, GRU, Transformer, HMM.\nKey challenge: long-range dependencies and exposure bias.\nUsed in language, speech, time-series, and control.',
  },
  mixture_of_experts: {
    summary: 'Model that routes inputs to specialized sub-models (experts)',
    explanation: 'Gating network chooses experts; sparse MoE scales to huge capacity.\nNeeds load balancing to avoid expert collapse.',
  },
  structural_risk_minimization: {
    summary: 'Choose model class to minimize empirical error plus capacity penalty',
    explanation: 'Balances bias and variance using VC dimension or regularization.\nFoundation for SVM theory and generalization bounds.',
  },
  concentration_inequalities: {
    summary: 'Bounds on how a random variable deviates from its expectation',
    explanation: 'Key tools: Markov, Chebyshev, Hoeffding, Chernoff.\nUsed to quantify sample complexity and generalization.',
  },
  chernoff_bound: {
    summary: 'Exponential tail bounds for sums of independent Bernoulli variables',
    explanation: 'P(X ≥ (1+δ)μ) ≤ exp(−μ δ^2 / 3) (one common form).\nStronger than Chebyshev for independent bounded variables.',
  },
  fano_inequality: {
    summary: 'Lower bound on error probability in terms of mutual information',
    explanation: 'Relates classification error to entropy of labels and information captured.\nUsed to prove impossibility and sample complexity lower bounds.',
  },
  pinsker_inequality: {
    summary: 'Bounds total variation by KL divergence: TV(P,Q) ≤ sqrt(0.5 * KL(P||Q))',
    explanation: 'Connects information-theoretic divergence to probability distance.\nUseful in learning theory and statistics.',
  },
  rate_distortion_theory: {
    summary: 'Tradeoff between compression rate and reconstruction error',
    explanation: 'Rate-distortion function R(D) gives minimum bits for distortion D.\nFoundation of lossy compression and representation learning.',
  },
  minimum_description_length: {
    summary: 'Choose the model that minimizes total description length: model + data given model',
    explanation: 'Formalizes Occam\'s razor. Equivalent to penalized likelihood / Bayesian evidence.\nUsed for model selection and preventing overfitting.',
  },
};
