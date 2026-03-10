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

  // ── SEMICONDUCTOR ──────────────────────────────────────────────
  mosfet_operation: {
    summary: 'Voltage-controlled transistor: gate voltage modulates channel conductance between drain and source',
    explanation: 'MOSFET (Metal-Oxide-Semiconductor FET) has four terminals: Gate, Drain, Source, Body.\nN-channel: Vgs > Vth inverts p-substrate → electron channel forms. Current Id flows drain→source.\nRegions: Cut-off (Vgs < Vth), Linear (Vds < Vgs−Vth), Saturation (Vds ≥ Vgs−Vth).\nSaturation: Id = (μn·Cox·W/2L)·(Vgs−Vth)². Transconductance gm = ∂Id/∂Vgs = μn·Cox·(W/L)·(Vgs−Vth).\nP-channel MOSFET: complementary; holes are carriers, Vgs < −|Vtp| to turn on.\nKey parameters: threshold voltage Vth, oxide capacitance Cox, W/L ratio, carrier mobility μ.',
  },
  bjt_operation: {
    summary: 'Current-controlled bipolar transistor: base current controls larger collector current via minority carrier injection',
    explanation: 'BJT (Bipolar Junction Transistor): two back-to-back PN junctions (NPN or PNP).\nNPN active mode: B-E forward biased, B-C reverse biased. Electrons injected from emitter into base, collected at collector.\nCurrent gain β (hFE) = Ic/Ib, typically 50–300. Ic = β·Ib, Ie = (β+1)·Ib.\nEbers-Moll model: Ic = Is·(e^(Vbe/Vt) − 1). Vt = kT/q ≈ 26 mV at 300 K.\nRegions: Active (amplification), Saturation (both junctions forward biased, Vce < Vce_sat ≈ 0.2 V), Cut-off (both reverse), Reverse-active.\nAdvantage over MOSFET: higher gm per current, lower noise; Disadvantage: higher power, harder to scale.',
  },
  cmos_logic: {
    summary: 'Complementary NMOS+PMOS pairs form logic gates with near-zero static power and full-swing output',
    explanation: 'CMOS (Complementary MOS): pull-up network (PMOS) + pull-down network (NMOS) always complementary—at most one path to VDD or GND at steady state.\nStatic power ≈ 0 (only leakage). Dynamic power = α·C·VDD²·f.\nNAND: series NMOS (PDN), parallel PMOS (PUN). NOR: parallel NMOS, series PMOS.\nNoise margin NMH = VOH − VIH, NML = VIL − VOL. Full-swing: VOH = VDD, VOL = 0.\nComplex CMOS gates: implement any Boolean function as single PDN/PUN pair.\nFan-out degrades speed: each additional gate load increases Cload, raises propagation delay tp ∝ Cload/Id.',
  },
  pn_junction: {
    summary: 'Junction between p-type and n-type semiconductor forms depletion region and rectifying diode behavior',
    explanation: 'At p-n interface, electrons diffuse to p-side, holes to n-side → built-in voltage Vbi ≈ 0.6–0.7 V (Si).\nDepletion width W ∝ 1/√NA or 1/√ND. W = sqrt(2ε·Vbi/(q·N)).\nForward bias: barrier lowered, exponential current Id = Is·(e^(V/nVt)−1). Reverse bias: thin depletion current ≈ −Is.\nBreakdown: Zener (tunneling, heavily doped, < 5 V), Avalanche (impact ionization, lightly doped, > 5 V).\nCapacitance: junction capacitance Cj = Cj0/(1−V/Vbi)^m (voltage-dependent); diffusion capacitance Cd in forward bias.\nApplications: rectifier, Zener regulator, varactor, photodiode, LED.',
  },
  bandgap_energy: {
    summary: 'Energy gap between valence and conduction bands determines semiconductor electrical and optical properties',
    explanation: 'Bandgap Eg (eV): energy required to excite electron from valence to conduction band.\nSi: Eg = 1.12 eV, Ge: 0.67 eV, GaAs: 1.42 eV, GaN: 3.4 eV, SiC: 2.86–3.26 eV.\nIntrinsic carrier concentration: ni = sqrt(Nc·Nv)·exp(−Eg/2kT). At 300 K, ni(Si) ≈ 1.5×10^10 cm^−3.\nDirect bandgap (GaAs, GaN): efficient light emission; used in LEDs and lasers.\nIndirect bandgap (Si, Ge): phonon-assisted recombination; poor light emitter.\nTemperature coefficient: Eg decreases with T (Varshni equation). Higher Eg → better high-temperature operation.',
  },
  carrier_mobility: {
    summary: 'Drift velocity per unit electric field; limits transistor speed and determines on-current',
    explanation: 'Mobility μ (cm²/V·s): vd = μ·E. Si at 300 K: μn ≈ 1400, μp ≈ 450 cm²/V·s. GaAs: μn ≈ 8500.\nScattering mechanisms: lattice (phonon) scattering ↑ with T; impurity (ionized dopant) scattering ↑ with doping.\nMobility degrades near Si-SiO₂ interface due to surface roughness scattering (key in MOSFETs).\nHigh-k dielectrics and strained Si improve effective mobility in modern nodes.\nVelocity saturation at high E: vsat ≈ 10^7 cm/s in Si; limits short-channel current vs. long-channel model.\nHole mobility lower than electron → PMOS slower than NMOS; compensated by wider W in CMOS.',
  },
  moores_law: {
    summary: 'Transistor count on a chip doubles roughly every two years, driving exponential performance gains',
    explanation: 'Gordon Moore (1965): IC component density doubles every year (revised to ~2 years).\nDriven by shrinking lithography: 10 μm (1970) → 7 nm (2018) → 3 nm (2022) → 2 nm (2025).\nDennard scaling: shrink by k → area /k², speed ×k, power density constant. Broke ~2005 (leakage currents).\nPost-Dennard era: multi-core, 3D stacking, heterogeneous integration compensate for slowed transistor scaling.\nEconomic Moore\'s law: cost per transistor falls ~30% per node. Fabs cost $20B+ for leading edge.\nAlternatives: GAAFETs (Gate-All-Around), 2D materials (MoS₂), tunnel FETs, neuromorphic chips.',
  },
  finfet: {
    summary: '3D multi-gate transistor with fin-shaped channel that suppresses short-channel leakage below 22 nm',
    explanation: 'FinFET: gate wraps around three sides of a thin silicon fin → superior electrostatic control.\nIntroduced at 22 nm node (Intel Ivy Bridge, 2011). Used down to ~5 nm.\nKey advantage: dramatically reduces subthreshold leakage (IOFF) vs. planar MOSFET.\nSSS (subthreshold slope): FinFET approaches 60 mV/decade limit; planar degrades at short L.\nDiscrete fin width quantizes W in multiples of fin pitch (~6–8 nm).\nSucceeded by GAAFET (gate-all-around): nanosheet or nanowire wraps gate on all 4 sides → even better control at < 3 nm.\nMulti-Vt: different threshold voltages achieved by work-function metal tuning, not channel doping.',
  },
  threshold_voltage: {
    summary: 'Minimum gate-source voltage that creates an inversion channel enabling significant drain current flow',
    explanation: 'Vth = Vfb + 2φF + Qd/Cox. φF = (kT/q)·ln(NA/ni), depletion charge Qd = −q·NA·Wmax.\nFlat-band voltage Vfb accounts for work-function difference and fixed oxide charge Qf.\nLow Vth → fast switching but higher leakage (IOFF). High Vth → lower leakage but slower.\nBody effect: Vth increases with reverse body-source bias VSB: ΔVth = γ·(√(2φF+VSB)−√(2φF)).\nShort-channel effect (SCE): source/drain depletion shares charge → Vth rolls off as L decreases (DIBL).\nDual-Vt / multi-Vt libraries: high-Vt cells in non-critical paths (leakage), low-Vt on critical paths (speed).',
  },
  short_channel_effects: {
    summary: 'Parasitic behaviors in scaled MOSFETs: Vth roll-off, DIBL, hot carriers, and velocity saturation',
    explanation: 'As channel length L shrinks, drain/source depletion regions encroach on channel:\n1. Vth roll-off: Vth decreases with shorter L (charge sharing).\n2. DIBL (Drain-Induced Barrier Lowering): drain field lowers source barrier → Vth decreases with Vds. Characterized by DIBL = ΔVth/ΔVds (mV/V).\n3. Punchthrough: depletion regions merge → gate loses control, uncontrolled current.\n4. Hot carrier injection: high-field carriers gain energy, inject into oxide → oxide degradation, Vth shift (HCI reliability).\n5. Velocity saturation: vd saturates at Esat → Id ∝ Vgs−Vth (linear, not quadratic).\nMitigation: halo/pocket implants, thin Tox, multi-gate (FinFET, GAAFET), retrograde doping.',
  },
  dram_sram: {
    summary: 'DRAM stores one bit per capacitor+transistor (dense, slow, volatile); SRAM uses 6 transistors (fast, stable, larger)',
    explanation: 'DRAM (Dynamic RAM): 1T1C cell. Capacitor charge = 1, discharged = 0. Must refresh every ~64 ms (charge leaks).\nRead destroys data → sense amplifier restores. Access time ~10–60 ns. Density: ~6F² per bit.\nSRAM (Static RAM): 6T cell (two cross-coupled inverters + 2 access FETs). Holds data without refresh.\nSRAM faster (< 1 ns), lower power during read, but ~60–80F² per bit → used for cache.\nDRAM types: DDR5 (up to 6400 MT/s), LPDDR5 (mobile), HBM (3D stacked, high bandwidth).\nEDO → SDRAM → DDR → DDR2/3/4/5: each generation doubles peak bandwidth via wider I/O or faster clocking.',
  },
  nand_flash: {
    summary: 'Non-volatile floating-gate or charge-trap cell stores charge to shift Vth; erased in blocks, written in pages',
    explanation: 'NAND Flash: cells connected in series strings (~32–128 cells). Dense, sequential access optimized.\nSLC (1 bit/cell, fast/durable), MLC (2), TLC (3), QLC (4 bits/cell, slow, fewer P/E cycles).\nP/E (program/erase): program via Fowler-Nordheim tunneling (FN) or hot-electron injection. Erase: FN tunneling removes stored charge.\nEndurance: SLC ~100 k P/E cycles, TLC ~1000–3000, QLC ~100–300.\n3D NAND (V-NAND): cells stacked vertically (64–256+ layers) → higher density without shrinking feature size.\nWear leveling + ECC required to manage cell degradation. Over-provisioning extends lifespan.\nNAND vs NOR Flash: NAND denser/faster sequential; NOR allows random byte-level reads (used for firmware/XIP).',
  },
  cmos_inverter: {
    summary: 'Simplest CMOS gate: PMOS pull-up + NMOS pull-down form a rail-to-rail inverter with near-zero static power',
    explanation: 'When Vin = 0: PMOS on, NMOS off → Vout = VDD. When Vin = VDD: NMOS on, PMOS off → Vout = 0.\nVTC (Voltage Transfer Characteristic): gain region where both transistors in saturation → steep transition.\nSwitching threshold VM: Vin = Vout. VM = (Vtp + VDD/2 + (Kn/Kp)^0.5·Vtn) / (1 + (Kn/Kp)^0.5).\nSizing for equal rise/fall: Wp/Lp ≈ 2×Wn/Ln (compensates lower hole mobility).\nDynamic power: P = α·C·VDD²·f. Shoot-through current during transition (short-circuit power).\nPropagation delay tp = (tpHL + tpLH)/2. Buffered by cascading inverters with tapering ratio e ≈ 2.7.',
  },
  latch_up_effect: {
    summary: 'Parasitic PNPN thyristor in CMOS conducts latch-up current that can destroy the chip if not interrupted',
    explanation: 'CMOS bulk silicon contains parasitic npn (n-well/p-sub/n+ drain) and pnp (p+/n-well/p-sub) BJTs forming a PNPN SCR.\nTrigger: substrate or well current from ESD, power-up transient, or radiation. If loop gain > 1 → latch-up.\nLatch-up condition: βnpn × βpnp > 1. Once latched, large current flows VDD→GND; device may burn.\nPrevention: guard rings (p+ tied to GND around NMOS, n+ tied to VDD around PMOS), well taps every Nth cell.\nDRC checks enforce minimum spacing between n+ and p+ diffusions and ensure guard rings present.\nLatch-up test: JEDEC JESD78 standard. ESD design also avoids triggering parasitic BJTs.',
  },
  photolithography: {
    summary: 'UV or EUV light projected through a mask patterns photoresist on wafer to define transistor geometries',
    explanation: 'Process: wafer coated with photoresist → exposed through mask (reticle) → developed → etch.\nResolution: R = k1·λ/NA (Rayleigh). k1 ≥ 0.25, NA up to 1.35 (immersion). Smaller λ → finer features.\nDUV (Deep UV, 193 nm ArF immersion): used for 7 nm–28 nm with multiple patterning (SADP, SAQP).\nEUV (Extreme UV, 13.5 nm): single-exposure patterning at 7 nm and below. Requires reflective optics, vacuum, high-power plasma source.\nMultiple patterning: split features across 2+ masks → effective pitch halved, but cost/complexity doubles.\nOverlay error: misalignment between layers; budget < 10% of feature size. Critical for multi-patterning.',
  },
  channel_length_modulation: {
    summary: 'Effective channel length shortens with increasing Vds in saturation, causing slight Id increase (λ parameter)',
    explanation: 'In saturation, pinch-off point moves toward source as Vds increases → effective L decreases.\nModified Id: Id = (μCox·W/2L)·(Vgs−Vth)²·(1 + λ·Vds). λ = channel-length modulation parameter.\nEarly voltage VA = 1/λ. Output resistance ro = VA/Id = 1/(λ·Id). Important for analog gain: Av = −gm·ro.\nλ ∝ 1/L: shorter channels have larger λ → worse output resistance → lower intrinsic gain.\nSpice model: Level 1 uses λ; BSIM models use more accurate Rout modeling.\nMitigation in analog design: use cascode, long-channel devices, regulated cascode to boost Rout.',
  },
  esd_protection: {
    summary: 'On-chip ESD clamps divert CDM/HBM discharge current away from sensitive circuits to prevent oxide breakdown',
    explanation: 'ESD (Electrostatic Discharge): 0.5–8 kV pulse, 1–10 ns. Human Body Model (HBM): 100 pF / 1.5 kΩ; Charged Device Model (CDM): fastest.\nOxide breakdown: Vox > Eox_crit·Tox (~10 MV/cm for SiO₂). Gate oxide in thin-node MOSFETs very vulnerable.\nProtection: GGNMOS (gate-grounded NMOS snapback), SCR clamps, diode-based (double-diode to VDD/GND rail clamps).\nPower clamp: large PMOS or SCR between VDD–GND triggered by RC sensing fast VDD rise during ESD.\nDesign: ESD window between Vmax trigger and Vmin device breakdown. Guard rings prevent latch-up.\nStandards: JEDEC JESD22-A114 (HBM), JEDEC JESD22-C101 (CDM), IEC 61000-4-2 (system level).',
  },
  power_delivery_network_ic: {
    summary: 'On-chip PDN distributes VDD with minimal IR drop and decoupling capacitance to stabilize supply voltage',
    explanation: 'PDN: hierarchical metal grid (global stripes M8–M10, local M1–M2) connecting C4 bumps to standard cell power pins.\nIR drop: Vdrop = I·Rpdn. Static IR drop analysis: worst-case at max current draw.\nDynamic IR drop (Ldi/dt): simultaneous switching causes voltage droop; decap absorbs transient charge.\nDecoupling capacitors (decaps): MOS caps placed near active cells. Target: reduce Δv < 10% VDD.\nEM (Electromigration): high current density (> Jmax) causes metal void/hillock. Constraint: J < Jmax (~1–10 MA/cm²).\nPower integrity sign-off: static IR (vectorless), dynamic IR (with switching patterns), EM checks (Redhawk, Voltus).',
  },
  signal_integrity_ic: {
    summary: 'On-chip signal integrity analyzes crosstalk, noise, and timing violations due to parasitic capacitance/inductance',
    explanation: 'Crosstalk: coupling capacitance Ccc between adjacent nets causes voltage noise (glitch) or timing shift.\nCrosstalk glitch: aggressor switching induces spike on quiet victim. Functional failure if glitch > Vnoise_margin.\nCrosstalk delay: aggressor switching in same direction → victim delay decreases; opposite → increases (worst case).\nShielding: insert ground wire between sensitive nets; increases wire pitch but reduces Ccc.\nSignal integrity analysis: SPEF (Standard Parasitic Exchange Format) extracted post-layout; SI engines (PrimeTime SI, Tempus).\nRF effects at GHz: skin effect, transmission-line effects on global wires → need termination or Z0 matching.',
  },
  setup_hold_timing: {
    summary: 'Setup time: data must arrive before clock edge; hold time: data must remain stable after clock edge',
    explanation: 'Setup time Tsetup: minimum time data must be stable before active clock edge for reliable capture.\nHold time Thold: minimum time data must remain stable after active clock edge.\nSetup violation: data changes too late → metastability → wrong value latched.\nHold violation: data changes too early → newly launched data corrupts current capture; independent of clock frequency.\nTiming check: Tarrival ≤ Tclock − Tsetup (setup); Tarrival ≥ Thold (hold).\nSlack = required time − arrival time. Positive slack = passing. Negative slack = violation.\nFix setup: reduce logic depth (buffer insertion, logic restructuring, higher drive cells), increase Vdd, or add pipeline stage.\nFix hold: insert delay buffers on data path.',
  },
  clock_skew: {
    summary: 'Difference in clock arrival time between two flip-flops; positive skew helps setup, negative skew hurts hold',
    explanation: 'Clock skew δ = Tclock(capture) − Tclock(launch). Caused by different wire lengths, buffer mismatches, process variation.\nSetup constraint with skew: Tlogic < Tcycle − Tsetup + δ. Positive δ loosens setup (useful skew).\nHold constraint: Tlogic > Thold − δ. Negative δ tightens hold (dangerous).\nClock tree synthesis (CTS): goal is zero-skew or controlled skew. H-tree, fishbone, mesh topologies.\nLocal skew: between two communicating FFs. Global skew: across chip. On-chip variation (OCV) adds uncertainty.\nClock uncertainty = skew + jitter. Applied as margin in STA. CRPR (clock reconvergence pessimism removal) removes over-pessimism.',
  },
  metastability: {
    summary: 'Flip-flop enters unpredictable intermediate state when timing constraints violated; resolves probabilistically',
    explanation: 'Metastability: when D input violates setup/hold, FF output settles to undefined voltage between 0 and 1.\nResolution time follows exponential distribution: P(unresolved after t) ∝ exp(−t/τ). τ ≈ 20–200 ps.\nMTBF (Mean Time Between Failure): MTBF = exp(Tres/τ) / (f·fa). Increase Tres (add synchronizer stages) to reduce failure rate.\nTwo-stage synchronizer: two cascaded FFs with long clock-to-Q delay. Each adds one cycle resolution time.\nCDC (Clock Domain Crossing): data crossing from clkA to clkB domain must use synchronizer.\nGray coding for multi-bit: only one bit changes per step → single synchronizer needed. Binary not safe for CDC.',
  },
  static_timing_analysis: {
    summary: 'Exhaustively verifies all timing paths meet setup/hold constraints without simulation using graph traversal',
    explanation: 'STA: compute arrival times (AT) and required times (RT) for every node in timing graph. Slack = RT − AT.\nStartpoint: FF clock pin or primary input. Endpoint: FF data pin or primary output.\nPath types: reg-to-reg, in-to-reg, reg-to-out, combinational. STA handles all paths simultaneously.\nPVT corners: Slow-slow-cold (setup), Fast-fast-hot (hold). OCV (On-Chip Variation): AOCV or POCV models.\nTool flow: synthesized netlist + SDF delay annotations + Liberty (.lib) cell timing → PrimeTime or Tempus.\nECO (Engineering Change Order): fix timing violations post-layout with minimal netlist changes.\nMulti-mode multi-corner (MMMC): run STA across functional modes (active, sleep) × PVT corners simultaneously.',
  },
  cmos_power_consumption: {
    summary: 'CMOS total power = dynamic (switching) + short-circuit + static (leakage); dynamic dominates at high frequency',
    explanation: 'Dynamic (switching) power: Pdyn = α·C·VDD²·f. α = activity factor (0–1), C = total switching capacitance.\nShort-circuit power: Psc = Isc·VDD during transition both PMOS and NMOS conduct. ~10–15% of Pdyn.\nLeakage (static) power: Pleak = Ileak·VDD. Sources: subthreshold leakage (dominant), gate tunneling, junction reverse.\nSubthreshold leakage: Id ∝ exp((Vgs−Vth)/nVt). Scales exponentially with Vth reduction → key concern at <28 nm.\nLow-power techniques: multi-Vt (high-Vt in non-critical paths), power gating (MTCMOS), clock gating, voltage scaling (DVFS).\nPower gating: header/footer switch cell disconnects VDD/GND from block; saves leakage at cost of wake-up latency.',
  },
  pvt_variations: {
    summary: 'Process, Voltage, Temperature variations cause transistor performance spread; design must meet spec at all corners',
    explanation: 'Process variation: wafer-to-wafer, die-to-die (global), within-die (local) variations in Vth, Tox, L, W.\nFast/Slow corners: FF (fast NMOS/fast PMOS), SS, FS, SF. Design must pass setup at SS and hold at FF.\nVoltage variation: IR drop across PDN causes local Vdd reduction → slower logic. Worst IR scenario for setup.\nTemperature: μ decreases with T (speed ↓); Vth decreases with T (speed ↑). Net: typically slower at cold for some nodes (temperature inversion).\nOCV (On-Chip Variation): AOCV (Advanced OCV) uses spatial correlation; POCV (Parametric OCV) uses statistical sigma.\nMonte Carlo SPICE: simulate full distribution of performance metrics across statistical process variation for SRAM, analog.',
  },

  // ── COMPUTER ARCHITECTURE ──────────────────────────────────────
  von_neumann_arch: {
    summary: 'Single shared memory stores both instructions and data; CPU fetches instructions sequentially via stored-program model',
    explanation: 'Von Neumann (1945): CPU + Memory + I/O. Memory holds both program and data (Princeton architecture).\nFetch-Decode-Execute cycle: PC→MAR→Memory fetch→MDR→IR→Decode→Execute→Write-back.\nVon Neumann bottleneck: single bus between CPU and memory limits throughput. Memory bandwidth < compute throughput.\nAll modern CPUs follow this model but add caches, pipelines, and out-of-order execution to hide bottleneck.\nKey components: ALU, CU (Control Unit), Registers, Program Counter (PC), Memory Address Register (MAR), Memory Data Register (MDR).\nDifference from Harvard: von Neumann uses unified memory; Harvard uses separate instruction and data memories (faster, used in DSPs/MCUs).',
  },
  harvard_architecture: {
    summary: 'Separate instruction and data memories with independent buses enable simultaneous fetch and data access',
    explanation: 'Harvard architecture: physically separate storage and signal pathways for code and data.\nAdvantage: instruction fetch and data memory access occur simultaneously → no structural hazards from shared bus.\nUsed in: DSPs (TI C6x), microcontrollers (AVR, PIC), modern CPUs use modified Harvard internally (separate I-cache/D-cache) but unified main memory.\nModified Harvard: L1I-cache and L1D-cache are separate (Harvard behavior) but backed by shared L2 cache and DRAM (von Neumann).\nInstruction ROM: some embedded MCUs have read-only program flash + read-write data RAM → true Harvard.\nHarvard advantage in DSPs: repeat instructions while loading next data coefficients → deterministic pipeline.',
  },
  cache_hierarchy: {
    summary: 'Multi-level cache (L1/L2/L3) exploits temporal and spatial locality to bridge CPU speed and DRAM latency gap',
    explanation: 'Memory hierarchy: Registers (~1 cycle) → L1 (~4 cycles, 32–64 KB) → L2 (~12 cycles, 256 KB–1 MB) → L3 (~40 cycles, 4–64 MB) → DRAM (~100 ns, GBs).\nLocality: temporal (recently used data reused soon), spatial (nearby data accessed together) → cache prefetching.\nCache organization: sets × ways × block_size. n-way set-associative: index selects set, tag identifies block.\nReplacement policy: LRU (least recently used), pseudo-LRU, FIFO, random.\nWrite policy: write-through (update memory on every write), write-back (mark dirty, flush on eviction). Write-allocate vs. no-write-allocate on miss.\nAMDT (Average Memory Access Time): AMAT = Hit_time + Miss_rate × Miss_penalty. Reducing miss rate or penalty is key.',
  },
  cache_coherence_mesi: {
    summary: 'MESI protocol ensures multi-core caches maintain a consistent view of shared memory via four states',
    explanation: 'MESI states per cache line: Modified (dirty, exclusive), Exclusive (clean, exclusive), Shared (clean, multiple copies), Invalid.\nTransitions: read miss → fetch from memory → Exclusive; another core reads → demote to Shared; write → upgrade to Modified (invalidate others).\nWrite-invalidate protocol: writing core invalidates all other copies first. Common in snooping (bus-based) systems.\nDirectory protocol: for large NUMA systems; directory tracks which caches hold each line → scalable (no broadcast).\nFalse sharing: two cores write different variables in same cache line → line ping-pongs → performance collapse. Fix: pad struct.\nMOESI adds Owned state; MESIF adds Forward state. Intel uses MESIF; AMD MOESI.',
  },
  virtual_memory: {
    summary: 'OS abstraction giving each process a private address space; pages mapped to physical frames on demand',
    explanation: 'Virtual address space: each process sees contiguous 0–2^48 (or 2^64) byte space; mapped to physical DRAM pages.\nPage table: hierarchical (4-level on x86-64: PGD/PUD/PMD/PTE). Each PTE maps 4 KB virtual page → physical frame + flags (present, dirty, R/W/X).\nPage fault: access to unmapped page → OS handles (demand paging: load from disk, allocate frame, update PTE, retry).\nSwapping: evict dirty pages to swap partition when physical memory full. Page replacement: LRU, Clock algorithm, WSClock.\nBenefits: process isolation, larger address space than physical RAM, memory-mapped files, copy-on-write fork.\nOverhead: page table walk (TLB to amortize), page fault latency (~1 ms for disk access).',
  },
  tlb: {
    summary: 'Translation Lookaside Buffer caches recent virtual-to-physical page translations to speed address translation',
    explanation: 'TLB: small fully-associative or set-associative cache holding recently used PTEs (~64–2048 entries).\nHit: virtual → physical in 1 cycle. Miss: page table walk (4 cycles minimum, up to 40+ for 4-level table).\nTLB reach: TLB_entries × page_size. 1024 entries × 4 KB = 4 MB. Huge pages (2 MB, 1 GB) increase reach dramatically.\nInvTLB (TLB shootdown): on context switch or address space modification, TLB must be invalidated (INVLPG or CR3 reload).\nPCID (Process-Context Identifier): tags TLB entries with process ID → avoid full flush on context switch. Used in Spectre mitigation.\nSoftware-managed TLB (MIPS): OS handles TLB miss. Hardware-managed TLB (x86): hardware page walker handles miss.',
  },
  cpu_pipeline: {
    summary: 'Pipeline overlaps instruction stages (Fetch-Decode-Execute-Memory-Writeback) to increase throughput',
    explanation: 'Classic 5-stage RISC pipeline: IF → ID → EX → MEM → WB. CPI → 1 ideally.\nHazards:\n1. Structural: two instructions need same hardware (e.g., single memory port).\n2. Data: RAW (read-after-write), WAR (write-after-read), WAW (write-after-write).\n3. Control: branch outcome unknown → fetch wrong instructions (branch penalty).\nForwarding/bypassing: route EX result directly to next instruction EX input → eliminates most RAW stalls.\nBranch prediction reduces control hazard penalty. Misprediction: flush pipeline (5–20 cycle penalty).\nDeeper pipelines (Intel Netburst: 31 stages): higher frequency but worse misprediction penalty. Modern: 14–20 stages.',
  },
  branch_prediction: {
    summary: 'CPU guesses branch direction before condition is computed to maintain pipeline throughput; mispredictions flush pipeline',
    explanation: 'Static prediction: always-taken, backward-taken-forward-not-taken (BTFNT for loops).\nDynamic prediction: Branch History Table (BHT): 1-bit or 2-bit saturating counter per PC.\n2-bit counter states: Strongly Taken / Weakly Taken / Weakly Not-Taken / Strongly Not-Taken. Avoids flip-flop on single mis.\nCorrelating predictor: uses global history shift register (GHR) XOR with PC to index BHT → captures inter-branch correlation.\nTournament predictor (Alpha 21264): selects between local and global predictor using a meta-predictor.\nTAGE predictor (modern): geometric history lengths; achieves ~98% accuracy.\nReturn Address Stack (RAS): predicts indirect jumps for function returns. Branch Target Buffer (BTB) caches target addresses.',
  },
  out_of_order_execution: {
    summary: 'CPU dynamically schedules instructions by data dependencies, not program order, to maximize functional unit utilization',
    explanation: 'OoO pipeline: Fetch → Decode → Rename → Dispatch → Issue → Execute → Writeback → Commit.\nRegister renaming: maps architectural registers to physical registers → eliminates false dependencies (WAR, WAW).\nReorder Buffer (ROB): tracks all in-flight instructions. Instructions commit in program order from ROB head.\nInstruction Queue / Reservation Station: instructions wait until all source operands ready → dispatched to execution units.\nLoad-store queue: handles memory ordering, detects load-store forwarding, ensures memory consistency.\nSpeculative execution: execute past branches; squash on misprediction. ROB holds speculative state.\nIPC: modern OoO CPUs achieve 3–5 IPC for integer, 4–8 for SIMD. Bottleneck: memory latency, branch misprediction, structural hazards.',
  },
  simd_instructions: {
    summary: 'Single Instruction Multiple Data executes one operation on multiple data elements in parallel using wide registers',
    explanation: 'SIMD: one instruction operates on N elements simultaneously. 256-bit register holds 8×float32 or 4×float64.\nISA extensions: MMX (64-bit), SSE/SSE2 (128-bit), AVX/AVX2 (256-bit), AVX-512 (512-bit, 16×float32).\nUse cases: image processing, matrix multiply, signal processing, cryptography (AES-NI), ML inference.\nVectorization: compiler auto-vectorization (-O2 -march=native) or manual intrinsics (_mm256_add_ps).\nData alignment: SIMD loads/stores ideally 32- or 64-byte aligned for performance (misaligned: slower or fault).\nARM NEON (128-bit), ARM SVE (scalable, 128–2048 bits). GPU warps are SIMT (single instruction multiple threads) variant.',
  },
  risc_vs_cisc: {
    summary: 'RISC uses simple fixed-width instructions executed in one cycle; CISC uses complex variable-length instructions with microcode',
    explanation: 'RISC (Reduced Instruction Set Computer): load-store architecture, fixed 32-bit instructions, large register file, pipelined.\nExamples: MIPS, ARM, RISC-V. Simple decoder → easier pipelining → high clock frequency.\nCISC (Complex Instruction Set): variable-length instructions, memory operands, complex addressing modes. Examples: x86, VAX.\nModern x86 decodes CISC instructions into RISC-like μops internally → "CISC on the outside, RISC on the inside".\nCode density: CISC higher (fewer bytes per operation) → matters for instruction cache efficiency, embedded systems.\nPerformance: similar IPC in practice (modern x86 vs ARM). Power: RISC typically lower (simpler decode). ARM dominates mobile.',
  },
  amdahls_law: {
    summary: 'Speedup from parallelization limited by serial fraction: Speedup ≤ 1/(s + (1-s)/N)',
    explanation: 'Amdahl\'s Law: if fraction s of program is serial, max speedup with N processors = 1/(s + (1−s)/N).\nAs N→∞: max speedup → 1/s. Serial bottleneck hard limits parallel scaling.\nExample: 5% serial code → max speedup = 20×, regardless of how many cores.\nGustafson\'s Law: scales problem size with N (scaled speedup). More optimistic for large workloads.\nApplications: predicts multicore diminishing returns, motivates minimizing serial sections (Amdahl bottlenecks).\nImplications: thread synchronization, OS overhead, I/O serialization all count as serial fraction.\nModern twist: heterogeneous computing (CPU+GPU) partitions workloads by parallelism class.',
  },
  dma_controller: {
    summary: 'DMA engine transfers data between memory and peripherals without CPU involvement, freeing CPU for computation',
    explanation: 'DMA (Direct Memory Access): CPU programs DMA controller (source, destination, length, mode) then continues.\nDMA arbitrates bus, performs memory-to-peripheral or memory-to-memory transfers, raises interrupt on completion.\nBurst mode vs cycle-stealing: burst takes bus until done; cycle-stealing interleaves with CPU bus cycles.\nScatter-gather DMA: descriptor list defines non-contiguous memory regions → avoids bounce buffers.\nCoherence issue: CPU cache may hold stale data after DMA write → need cache flush/invalidate before/after DMA.\nModern SoCs: multiple DMA channels (GPDMA); IOMMU maps peripheral virtual addresses → physical, provides isolation.\nUsed in: USB, PCIe, SDIO, I2S audio, ADC data capture, GPU memory transfers.',
  },
  interrupt_handling: {
    summary: 'Hardware signals CPU to save context, execute ISR, then resume normal execution with minimal latency',
    explanation: 'Interrupt types: hardware (external IRQ, NMI), software (syscall, int 0x80), exceptions (fault, trap, abort).\nCPU response: finish current instruction → save PC + flags to stack → load ISR address from IDT/IVT → execute ISR → IRET.\nLatency: IRQ asserted → first ISR instruction: ~10–50 cycles (x86), ~12 cycles (ARM Cortex-M).\nNested interrupts: higher-priority interrupt preempts lower-priority ISR. Priority levels (NVIC: 0–255 in ARM).\nInterrupt controller: PIC (legacy 8259), APIC (x86 multicore), GIC (ARM). Handles priority, masking, routing.\nISR best practice: keep short (set flag, defer work to task/workqueue). Deferred: bottom half, softirq, tasklet (Linux).\nReal-time systems: WCET (Worst Case Execution Time) of ISR must be bounded for hard RT guarantees.',
  },
  axi_bus_protocol: {
    summary: 'ARM AMBA AXI4 high-performance on-chip bus with separate read/write channels and burst transfers',
    explanation: 'AXI (Advanced eXtensible Interface): 5 independent channels: AW (write address), W (write data), B (write response), AR (read address), R (read data).\nFully decoupled channels allow reorder, out-of-order completion using transaction IDs.\nHandshake: VALID/READY handshake on each channel. Transfer occurs when both asserted.\nBurst types: FIXED, INCR (incrementing), WRAP. Burst length up to 256 beats. Data width up to 1024 bits.\nOutstanding transactions: multiple in-flight AXI transactions supported → hides memory latency.\nAXI4-Lite: simplified, single transfer, no burst → for register-map peripherals.\nAXI4-Stream: unidirectional data streaming, no address phase → for video/audio/DMA data paths.',
  },
  pcie_protocol: {
    summary: 'PCIe serial differential link with packet-based TLP protocol scales bandwidth by adding lanes (x1/x4/x8/x16)',
    explanation: 'PCIe: point-to-point serial interconnect using differential pairs. Gen3: 8 GT/s/lane, Gen4: 16 GT/s/lane, Gen5: 32 GT/s/lane.\nBandwidth: x16 Gen4 = 16 GT/s × 16 lanes × 128/130 encoding ≈ 31.5 GB/s.\nTLP (Transaction Layer Packet): Memory Read, Memory Write, Completion. Split-transaction: Read request + Completion later.\nFlow control: credits prevent receiver overflow. Posted writes (no completion required) vs. non-posted reads.\nLayers: Transaction → Data Link (DLLP, ACK/NAK, sequence numbers, CRC) → Physical (LTSSM link training, scrambling, 128b/130b).\nLink training: LTSSM (Link Training and Status State Machine) negotiates speed and width during initialization.\nSR-IOV: single physical device exposed as multiple virtual functions → NIC virtualization, GPU direct.',
  },
  numa_architecture: {
    summary: 'Non-Uniform Memory Access: each CPU has local RAM with low latency; accessing remote NUMA node RAM is slower',
    explanation: 'NUMA: multi-socket servers where each socket has local DRAM. Local access: ~80 ns; remote (cross-socket): ~150–200 ns.\nNUMA ratio: remote latency / local latency. Lower is better. Affected by QPI/UPI interconnect bandwidth.\nOS NUMA-awareness: numactl, libnuma. Applications should allocate memory on same NUMA node as threads.\nCPU topology: socket → NUMA node → die → core → SMT thread. lscpu, numastat, hwloc for discovery.\nNUMA effects on HPC: poor NUMA placement doubles memory latency → 2× performance loss for memory-bound workloads.\ncNUMA (cache NUMA): AMD EPYC uses CCD/CCX with NUMA effects even within single socket.\nLinux: NUMA balancing auto-migrates pages; but frequent migration overhead can hurt. Pin critical threads: taskset/numactl.',
  },
  gpu_architecture: {
    summary: 'GPU contains thousands of simple cores organized in SMs executing warps of 32 threads in SIMT fashion',
    explanation: 'GPU SM (Streaming Multiprocessor): ~128 CUDA cores + warp schedulers + shared memory + L1 cache.\nWarp: 32 threads executing same instruction in lockstep (SIMT). Divergent branches: serialize both paths (warp divergence).\nThread hierarchy: thread → warp → thread block (up to 1024 threads, share SMEM) → grid.\nMemory: global DRAM (HBM, ~2–4 TB/s bandwidth), L2 cache (~40–80 MB), L1/SMEM (per SM), registers.\nOccupancy: fraction of max warps active per SM. Limited by register count, shared memory usage, thread block size.\nNVIDIA A100: 6912 CUDA cores, 80 GB HBM2e, 2 TB/s bandwidth, 77.6 TFLOPS FP16.\nLatency hiding: GPU switches warp on memory stall (zero-overhead) → needs 1000s threads to hide 100s-cycle DRAM latency.',
  },
  memory_bandwidth_latency: {
    summary: 'Bandwidth = bytes/second capacity of memory bus; latency = time for single access; both limit performance differently',
    explanation: 'Bandwidth: peak = bus_width × clock × transfers_per_clock. DDR5-6400: 64-bit × 6.4 GT/s = 51.2 GB/s per channel.\nLatency: CAS latency CL + RCD + RP in nanoseconds. DDR5-6400 CL40: tCAS = 40/3200 MHz = 12.5 ns; effective ≈ 50–60 ns round trip.\nBandwidth-bound: matrix multiply, stencil codes; limited by bytes/s. Latency-bound: pointer chasing, random access.\nLittle\'s Law: bandwidth = concurrency / latency. Increase outstanding memory requests to utilize bandwidth.\nHBM (High Bandwidth Memory): 3D stacked DRAM with wide bus (1024-bit/stack). HBM3: 819 GB/s per stack.\nMemory controller: manages refresh, read/write scheduling (FR-FCFS), power modes (CKE gating, self-refresh).',
  },
  roofline_model: {
    summary: 'Roofline model bounds performance by either peak compute (FLOP/s) or peak memory bandwidth × arithmetic intensity',
    explanation: 'Roofline: Performance ≤ min(Peak_FLOPs/s, Bandwidth × Arithmetic_Intensity).\nArithmetic Intensity (AI) = FLOPs / Bytes_accessed. Ridge point: AI where compute = memory bound.\nMemory-bound region: AI < ridge point → performance ∝ AI × bandwidth. Compute-bound: AI > ridge point.\nExample: V100 GPU: 900 GB/s bandwidth, 14 TFLOPS FP32. Ridge = 14T/900G ≈ 15.5 FLOPs/byte.\nGEMM (matrix multiply): O(N³) FLOPs, O(N²) bytes → AI = O(N). Large N → compute-bound.\nStencil kernels: low AI (typically 1–5 FLOPs/byte) → always memory-bound. Optimization: blocking, streaming.\nExtended roofline: add ceilings for vectorization, cache bandwidth, NUMA effects.',
  },
  clock_domain_crossing: {
    summary: 'Logic signals crossing between different clock domains require synchronization to prevent metastability and data loss',
    explanation: 'CDC (Clock Domain Crossing): signal generated in clkA domain, sampled in clkB domain. Asynchronous → setup/hold may be violated.\nSingle-bit CDC: use double flip-flop synchronizer (two FFs clocked by destination domain). Adds 2-cycle latency.\nMulti-bit CDC options:\n1. Gray code (for counters): only 1 bit changes per transition → single synchronizer safe.\n2. Handshake (req/ack): sender asserts req, waits for ack from receiver domain. Low bandwidth.\n3. Asynchronous FIFO: separate read/write pointers in each domain; compare via synchronized Gray-coded pointers.\nCDC verification: formal CDC analysis (Questa CDC, SpyGlass) checks for missing synchronizers and convergence.\nFast-to-slow domain: possible data loss if pulse narrower than slow clock period → use pulse stretcher or FIFO.',
  },
  fpga_architecture: {
    summary: 'FPGA contains configurable logic blocks, DSP slices, block RAM, and routing fabric reprogrammed via bitstream',
    explanation: 'FPGA structure: LUTs (Look-Up Tables, typically 6-input), flip-flops, carry chains, BRAM (18 Kb–36 Kb tiles), DSP48 blocks.\n6-input LUT: implements any 6-variable Boolean function → stored in 64-bit SRAM config. One LUT + FF = one "slice".\nHierarchy: LUT → Slice (2–4 LUTs + FFs) → CLB (Configurable Logic Block) → routing fabric.\nRouting: programmable switch boxes and connection boxes. Key performance limiter: routing delay (~60% of total).\nBRAM: dual-port synchronous 18/36 Kb blocks. Used for FIFOs, ROMs, small data caches, shift registers.\nDSP48: pipelined multiply-accumulate (MAE: A×B+C). Used for FIR filters, FFTs, matrix multiply.\nFPGA vs ASIC: FPGA slower (~5–10×), more power (~10×), but zero NRE cost, reprogrammable. Used for prototyping, low-volume.',
  },
  superscalar_processor: {
    summary: 'Issues multiple independent instructions per clock cycle using parallel functional units to exceed CPI=1',
    explanation: 'Superscalar: fetch + decode + issue N instructions per cycle (N = issue width, typically 2–8).\nIn-order superscalar: decode N, issue if no hazard. Limited by dependence chains.\nOut-of-order superscalar: rename registers, dispatch to RS, issue when operands ready → exploits instruction-level parallelism (ILP).\nFunctional units: integer ALU (multiple), FP units, load/store units (AGU + LSU), branch unit, vector units.\nIPC: modern OoO superscalar CPUs achieve 3–5 IPC (SPEC integer). Theoretical max = issue width.\nBottlenecks: data dependencies (RAW chains), memory latency, branch misprediction, structural hazards.\nExamples: Apple M3 (8-wide decode), AMD Zen4 (6-wide), Intel Golden Cove (6-wide). Wider → more area/power for diminishing IPC returns.',
  },
  speculative_execution: {
    summary: 'CPU executes instructions beyond unresolved branches or memory dependencies; results discarded if prediction wrong',
    explanation: 'Speculative execution: proceed past branch/load before outcome known. Commit only when speculation confirmed correct.\nBranch speculation: predict taken/not-taken, fetch and execute speculative path. Misprediction: squash ROB, restore state.\nValue prediction: predict load value based on history → experimental, rare in production.\nMemory disambiguation: store-load speculation; if address conflict detected → re-execute load.\nSecurity: Spectre (variant 1: bounds check bypass, variant 2: indirect branch, variant 3: rogue data cache load).\nSpectre exploits: attacker trains branch predictor or BTB → victim speculatively executes gadget → side-channel (cache timing) leaks secrets.\nMitigations: retpoline (indirect branch via ret), IBRS/IBPB (microcode), LFENCE serialization, kernel page-table isolation (KPTI).',
  },
  memory_hierarchy: {
    summary: 'Pyramid of memory technologies balancing speed and capacity: registers → cache → DRAM → NVMe SSD → HDD',
    explanation: 'Registers: ~1 cycle, ~64×64-bit per core, in CPU. Compiler-managed.\nL1 cache: 4–5 cycles, 32–64 KB, per-core. Separate I/D cache.\nL2 cache: 10–15 cycles, 256 KB–2 MB, per-core or shared.\nL3 cache: 30–50 cycles, 4–64 MB+, shared across cores.\nDRAM: 60–100 ns, GB range, volatile. Main memory.\nNVMe SSD: 50–100 μs, TB range, non-volatile. PCIe Gen4×4 up to 7 GB/s.\nHDD: 5–10 ms seek + rotational latency, tens of TB. Mechanical. Cheapest per GB.\nStorage class memory (Optane, 3D XPoint): ~300 ns, fills DRAM–SSD gap. Discontinued by Intel.\nCost hierarchy: registers > SRAM > DRAM > NAND Flash > HDD ($ per GB, decreasing).',
  },

  // ── SEMICONDUCTOR (extended) ────────────────────────────────────
  schottky_diode: {
    summary: 'Metal-semiconductor junction diode with low forward voltage (~0.3 V) and fast switching; no minority carrier storage',
    explanation: 'Schottky barrier: metal deposited on lightly doped n-Si. Majority carrier device — no minority carrier injection → no reverse recovery time.\nVf ≈ 0.2–0.4 V (Si Schottky), vs. 0.6–0.7 V PN junction. Lower conduction loss in rectifiers.\nReverse recovery: essentially zero (only junction capacitance Cj). Enables MHz-range switching in DC-DC converters.\nBarrier height φB set by metal work function and semiconductor electron affinity. Metals: PtSi, TiSi₂, NiSi.\nLeakage: higher than PN junction (Schottky I0 >> PN I0) due to thermionic emission over lower barrier.\nApplications: rectifiers in SMPS, clamping diodes in TTL/Schottky logic, RF mixers, solar cell contacts.',
  },
  zener_diode: {
    summary: 'Diode operating in reverse breakdown for voltage regulation; Zener effect (<5 V) or avalanche (>5 V)',
    explanation: 'Zener breakdown: heavily doped p-n junction. Narrow depletion layer → high E-field → band-to-band tunneling.\nAvalanche breakdown: impact ionization chain; higher voltage, positive temperature coefficient.\nAt ~5–6 V: both mechanisms coexist; temperature coefficient ≈ 0 (temperature-stable reference).\nVZ temperature coefficient: Zener (< 5 V) negative; avalanche (> 6 V) positive. ~5.6 V diode most stable.\nDynamic impedance rZ = ΔVZ/ΔIZ: good voltage reference needs low rZ. Typical 1–50 Ω.\nApplications: voltage reference, overvoltage protection clamp, shunt regulator. Replace with bandgap reference for precision.',
  },
  differential_pair: {
    summary: 'Two matched transistors share a tail current; amplifies difference signal and rejects common-mode noise',
    explanation: 'Diff pair: Q1, Q2 share emitter/source tail current source ITAIL. Vid = V1 − V2; Vic = (V1+V2)/2.\nDifferential gain: Ad = gm·RC (BJT) or gm·RD (MOSFET).\nCommon-mode gain: Acm = −RC/(2·Rtail). CMRR = |Ad/Acm| = gm·Rtail.\nWith ideal tail current source: CMRR → ∞. Real: CMRR typically 60–120 dB.\nLarge-signal: tanh transfer function for BJT. Fully steers current at |Vid| ≈ 4VT ≈ 100 mV.\nApplications: op-amp input stage, comparator, mixer, ADC frontend. Matched layout critical to minimize offset.',
  },
  current_mirror: {
    summary: 'Two-transistor circuit that copies a reference current to multiple output branches with high output impedance',
    explanation: 'Basic MOSFET mirror: reference M1 diode-connected (Vgs1 = Vds1), M2 identical → same Vgs → copies ID.\nMismatch sources: ΔW/L mismatch, VDS difference (channel-length modulation λ), threshold variation ΔVth.\nImprovement — Cascode mirror: M3/M4 in cascode → Rout = gm·ro² (much higher than basic ro).\nWilson mirror (BJT): negative feedback reduces base-current error. βerror: base current error = IC/(β+1).\nWidlar mirror: unequal emitter degeneration resistors → output IC proportional to ln(IC_ref).\nApplications: bias generation in analog ICs, load element in diff pair, DAC current cells.',
  },
  cascode_amplifier: {
    summary: 'Two-transistor stack (common-source + common-gate) achieves high gain by boosting output impedance via gm·ro² stacking',
    explanation: 'Cascode: M1 (CS input stage) + M2 (CG cascode). Rout = gm2·ro2·ro1 ≫ ro1 alone.\nIntrinsic gain: Av = −gm1·Rout ≈ −gm1·gm2·ro2·ro1. Typically 60–80 dB for one stage.\nMiller effect suppressed: M2 shields M1 drain, so Cgd of M1 is no longer multiplied by gain → better frequency response.\nGain-bandwidth product (GBW) = gm/(2π·Cin). Cascode improves gain without reducing GBW.\nFolded cascode: PMOS cascode above NMOS input → wider output swing, easier biasing.\nRegulated cascode: auxiliary amp forces VDS1 = const → Rout → gm2·ro2·Av_aux·ro1 (even higher).',
  },
  op_amp_basics: {
    summary: 'High-gain differential amplifier with negative feedback to set closed-loop gain, bandwidth, and impedance',
    explanation: 'Ideal op-amp: Av → ∞, Rin → ∞, Rout → 0, infinite bandwidth.\nReal: finite open-loop gain A0 (80–120 dB), unity-gain bandwidth (GBW = A0·f3dB), input offset voltage Vos, bias current Ib.\nNegative feedback: Vout = A·(V+ − V−). With feedback β: closed-loop gain = A/(1+Aβ) ≈ 1/β for Aβ ≫ 1.\nInverting: gain = −Rf/Rin. Non-inverting: gain = 1 + Rf/Rin. Virtual short: V+ ≈ V−.\nPhase margin: must be ≥ 45° for stability. Dominant-pole compensation adds large Cc capacitor (Miller compensation).\nKey specs: slew rate SR = ITAIL/Cc, CMRR, PSRR, noise (input-referred voltage noise en).',
  },
  bandgap_reference: {
    summary: 'Voltage reference that cancels PTAT and CTAT components to produce ~1.25 V stable across temperature',
    explanation: 'Bandgap reference (Widlar 1971): combines PTAT (proportional to absolute temperature) and CTAT (complementary to T) voltages.\nVBE of BJT: CTAT, dVBE/dT ≈ −2 mV/K. ΔVT = (kT/q)·ln(N): PTAT.\nVref = VBE + K·ΔVT = 1.25 V ≈ silicon bandgap Eg/q at 0 K.\nDesign: two BJTs at different current densities (ratio N). Resistor ratio sets K to null first-order TC.\nSecond-order compensation: curvature correction for non-linear VBE(T). Achieved with extra BJT or PTAT² term.\nAccuracy: ±1–2% without trim; ±0.1% with laser trim. Used in every ADC, DAC, LDO reference.',
  },
  charge_pump: {
    summary: 'Switched-capacitor circuit that generates voltages above VDD or below GND without magnetic components',
    explanation: 'Charge pump: flying capacitors charge to VDD, then stacked in series to output → 2×VDD (doubler), or 3×VDD (tripler).\nDickson charge pump: diode-connected stages, clock-driven flying capacitors. Vout_N = N·VDD − N·Vf (diode drops).\nNegative charge pump: inverts supply → −VDD. Used for substrate bias, EEPROM erase voltage.\nCross-coupled doubler (modern): MOSFET switches minimize voltage loss vs. diode stages.\nEfficiency: η = Pout/Pin. Limited by capacitor ESR, switch resistance, clock capacitance, and leakage.\nApplications: Flash/EEPROM programming voltage (12–18 V from 3.3 V), LCD bias, gate drivers for high-side switches.',
  },
  phase_locked_loop: {
    summary: 'Feedback control loop that locks output oscillator frequency and phase to a reference signal',
    explanation: 'PLL blocks: Phase Detector (PD) → Loop Filter (LF) → VCO → ÷N divider → back to PD.\nPhase detector: outputs signal proportional to phase error φe = φref − φout/N. XOR (digital), charge pump (Type-2).\nVCO: Kvco (Hz/V) converts control voltage to frequency. Kvco linearity crucial for PLL bandwidth.\nLoop filter: low-pass; sets loop bandwidth ωn and phase margin. 2nd-order type-2 PLL: ωn = √(Icp·Kvco/(2π·C1)), PM = arctan(ωn·C2·R).\nLock range vs. capture range: lock range > capture range. PLL tracks within lock range, acquires within capture range.\nApplications: clock synthesis (CPU PLLs, DDR PLL), FM demodulation, frequency synthesis, clock recovery in SerDes.',
  },
  adc_basics: {
    summary: 'Analog-to-Digital Converter maps continuous analog input to discrete digital code; key specs: ENOB, SNR, SFDR',
    explanation: 'ADC types by architecture: Flash (fastest, 2^N comparators), SAR (successive approximation, power-efficient), Sigma-delta (high resolution, oversampling), Pipeline (high-speed, moderate resolution).\nResolution N bits → 2^N levels. LSB = Vref/2^N. Quantization noise: Vq_rms = LSB/√12.\nSNR (ideal) = 6.02N + 1.76 dB. ENOB = (SNR_actual − 1.76)/6.02.\nSFDR (Spurious Free Dynamic Range): ratio of fundamental to worst spurious tone. Critical for comms ADCs.\nINL/DNL: Integral/Differential Nonlinearity. INL < ±0.5 LSB for monotonic. DNL < −1 LSB causes missing codes.\nKey specs: ENOB, SNR, SFDR, bandwidth, power, sampling rate. Walden figure: FOM = P/(2^ENOB·fs).',
  },
  dac_basics: {
    summary: 'Digital-to-Analog Converter converts binary code to analog voltage or current; types: R-2R, current steering, PWM',
    explanation: 'DAC types: R-2R ladder (area-efficient, 2 resistors/bit), current-steering (fast, thermometer coded), string (resistor string, inherently monotonic), PWM (simple, slow, high ripple).\nR-2R ladder: binary-weighted currents sum at virtual ground. Matching of R critical for INL.\nCurrent-steering DAC: N-bit thermometer coded → 2^N−1 identical current cells → parallel output. Fast settling (100 MHz+), good SFDR.\nGlitch: during code transition, momentary wrong code → glitch energy. Deglitcher (sample-and-hold) needed for audio DACs.\nKey specs: SFDR, THD, settling time, output impedance. For audio: 16–24 bit, 44.1–192 kHz. RF DAC: 12–14 bit, GS/s.\nCalibration: dynamic element matching (DEM) shuffles current cells to average mismatch → reduces harmonic distortion.',
  },
  sigma_delta_adc: {
    summary: 'Oversampling + noise-shaping ADC achieves high resolution by pushing quantization noise to high frequencies',
    explanation: 'Sigma-delta (ΣΔ) ADC: oversample at fs ≫ 2·BW, then noise-shape with integrator feedback loop.\nNoise shaping: NTF = (1−z^−1)^L for Lth-order loop. Pushes noise power out of signal band.\nSNR ≈ 6.02N + 1.76 + 10·log(OSR^(2L+1)) dB. OSR = fs/(2·BW). Each 4× OSR: +12 dB (1st order) or more (higher order).\nDigital decimation filter: low-pass filter + downsample removes out-of-band noise → high-resolution output at Nyquist rate.\nLoop stability: higher-order (L ≥ 3) loops need careful design (NTF zeros, feedforward coefficients) to avoid oscillation.\nApplications: audio ADC (24-bit, 192 kHz), sensor interfaces (temperature, pressure), precision measurement instruments.',
  },
  switched_capacitor: {
    summary: 'Switched-capacitor circuit uses clocked MOSFET switches and capacitors to implement resistors and filters on CMOS',
    explanation: 'SC resistor equivalent: capacitor C switched at frequency fs → equivalent R = 1/(C·fs). Enables precision ratios (no absolute values).\nSC integrator: Vin → C1 → (charge transfer to C2) → Vout. Gain ratio C1/C2 set by capacitor matching (< 0.1% with careful layout).\nSC filter: implement biquad sections using SC integrators. Exact frequency response scales with fs, not RC absolute values.\nClock phases: φ1 (sample on C1), φ2 (transfer to C2). Non-overlapping clocks critical to avoid charge sharing.\nkT/C noise: thermal noise sampled on capacitor Vnoise² = kT/C. Larger C → lower noise. Design trade-off: noise vs. area.\nApplications: ADC sample-and-hold, SC DAC, switched-capacitor filters, multiplying DAC in pipeline ADC stages.',
  },
  ldo_regulator: {
    summary: 'Low-dropout linear regulator passes current through series pass element to output regulated voltage with low headroom',
    explanation: 'LDO: pass transistor (PMOS or NFET) in series, error amp compares Vout/Vref, controls gate.\nDropout voltage Vdrop = VIN − VOUT_min = VGS + VDS_sat of pass FET. PMOS LDO: Vdrop ≈ 0.2–0.5 V.\nPSRR (Power Supply Rejection Ratio): how well LDO rejects VIN ripple. High PSRR needed for RF/analog supplies.\nLoad transient response: output capacitor COUT and error amp bandwidth determine undershoot/overshoot. ESR of COUT affects stability.\nStability: dominant pole at output (COUT + RESR zero); second pole at error amp output. Phase margin ≥ 45° required.\nQuiescent current IQ: power wasted even at no load. Ultra-low IQ LDOs (1 μA): used in IoT battery-powered devices.\nEfficiency: η = VOUT/VIN. LDO wastes (VIN−VOUT)·ILOAD as heat. Use SMPS for large VIN−VOUT difference.',
  },
  buck_converter: {
    summary: 'Step-down switching regulator uses inductor energy storage to convert higher VIN to lower VOUT with high efficiency',
    explanation: 'Buck converter: high-side switch (SW) + low-side diode/switch + inductor L + output capacitor C.\nOperation: SW on → VL = VIN−VOUT, inductor current rises. SW off → diode conducts, VL = −VOUT, current falls.\nDuty cycle D = VOUT/VIN (ideal, continuous conduction mode, CCM). Regulates via PWM.\nInductor ripple: ΔIL = (VIN−VOUT)·D/(L·fs). Output voltage ripple: ΔV ≈ ΔIL/(8·C·fs).\nEfficiency: η > 90% typical. Losses: switching (Coss·VIN²·fs), conduction (IL²·RDS), inductor DCR, gate drive.\nSynchronous buck: replaces diode with low-side MOSFET → eliminates diode drop → higher efficiency at high IL.\nControl modes: voltage-mode PWM, current-mode (peak/average current), constant-on-time (COT, fast transient).',
  },
  boost_converter: {
    summary: 'Step-up switching regulator stores energy in inductor during on-time and releases it above VIN to output capacitor',
    explanation: 'Boost converter: inductor L in series, low-side switch SW, diode to output capacitor C.\nOperation: SW on → VL = VIN, energy stored in L, diode reverse biased. SW off → VL = VIN−VOUT < 0, diode conducts.\nIdeal CCM: VOUT = VIN/(1−D). D → 1: very high voltage step-up possible (limited by parasitic resistance).\nRight-half-plane (RHP) zero: boost/flyback have RHP zero at fRHPZ = (1−D)²·R/(2π·L). Limits control bandwidth.\nMax duty cycle limited by MOSFET turn-off losses and minimum off-time. Practical Dmax ≈ 0.8–0.9.\nApplications: battery-powered LED drivers (Vbat < VLED), power factor correction (PFC), USB PD, IoT power management.',
  },
  substrate_noise: {
    summary: 'Digital switching noise couples through shared silicon substrate to disturb analog/RF circuits on the same die',
    explanation: 'Substrate: low-resistivity p-type Si (~10 Ω·cm). Digital gates switching → charge injected via bulk/drain junction → spreads through substrate.\nCoupling paths: capacitive (Cjunction), resistive (Rsub), inductive (wire bond/package inductance).\nEpitaxial substrate (p+/p−): thin p− on p+ → higher attenuation of lateral noise spreading.\nMitigation: deep n-well isolation (reverses junction polarity), guard rings (p+ or n+ rings connected to clean supply), separate supplies and grounds for analog/digital.\nSubstrate modulation: substrate noise modulates VTH of analog transistors → oscillator phase noise, ADC SFDR degradation.\nSoC verification: substrate noise simulation (tools: Virtuoso, HSPICE substrate netlist). Often underestimated in early design.',
  },
  ic_packaging: {
    summary: 'IC package provides mechanical support, electrical connections, and thermal path from die to PCB',
    explanation: 'Package types: DIP (through-hole, legacy), QFP (quad flat pack, fine-pitch leads), BGA (ball grid array, high pin count), CSP (chip-scale), QFN (no-lead, low inductance).\nFlip-chip: die flipped, C4 solder bumps bond to substrate directly. Short interconnect → low inductance (~1 pH/bump vs. ~1 nH wire bond).\nMCM (Multi-Chip Module): multiple dies in one package. SiP (System-in-Package): 2.5D/3D integration.\nThermal resistance: θJA (junction-to-ambient) = θJC + θCS + θSA. Lower θJA → cooler die at same power.\nPackage parasitic: lead inductance (wire bond ~1 nH), pin capacitance (~1 pF), ground inductance causes di/dt noise.\nHermetic packages (ceramic): for military/space — sealed, moisture-resistant. Plastic (molded epoxy): consumer cost-optimized.',
  },
  wafer_fabrication: {
    summary: 'CMOS IC manufacturing process: hundreds of photolithography, implant, etch, and deposition steps to build transistors',
    explanation: 'Start: p-type silicon wafer (300 mm diameter, < 1 Ω·cm). Polished, ~775 μm thick.\nKey process steps:\n1. Shallow Trench Isolation (STI): etch + SiO₂ fill to isolate devices.\n2. Well formation: n-well (p-type substrate + n implant), p-well for CMOS.\n3. Gate stack: grow thin gate oxide (SiO₂ or high-k HfO₂) + deposit poly-Si or metal gate.\n4. LDD (Lightly Doped Drain) implant: reduces hot carrier effect.\n5. Sidewall spacer: SiN deposited + etched to form spacer → define source/drain from gate edge.\n6. S/D implant + anneal: activate dopants.\n7. Silicidation: NiSi or CoSi₂ on S/D/gate → low contact resistance.\n8. Back-end (BEOL): CVD interlayer dielectric, Cu dual-damascene wiring (up to M12+), CMP.\nYield: fraction of working dies. Defect density D0: Y ≈ exp(−A·D0). 300 mm wafer: ~1000 dies at 10 mm² each.',
  },
  ion_implantation: {
    summary: 'Dopant atoms accelerated into silicon wafer to precisely control concentration depth profile in transistor regions',
    explanation: 'Ion implanter: ion source (BF₃, PH₃, AsH₃) → mass analyzer (selects species) → accelerator (10 keV–MeV) → beam scanner → wafer.\nProjected range Rp: peak dopant depth. Straggle ΔRp: statistical spread. Gaussian profile approximation.\nHigh-energy: deep well formation. Low-energy: shallow source/drain extension (SDE), halo implants.\nTilt implant: beam at angle (7°) to achieve angled halo/pocket underneath gate to suppress DIBL.\nDamage: implantation amorphizes crystal. Rapid Thermal Anneal (RTA, 1000–1100°C, ~10 s) recrystallizes and activates dopants.\nChanneling: ions travel along crystal planes → deeper Rp. Wafer tilt ≈ 7° to crystal axis (off-axis implant) prevents channeling.',
  },
  chemical_vapor_deposition: {
    summary: 'CVD deposits thin films by chemical reaction of precursor gases on heated wafer surface for dielectrics and metals',
    explanation: 'CVD: gaseous precursors react at wafer surface to deposit solid thin film. LPCVD (low-pressure): conformal, batch. PECVD (plasma-enhanced): lower temperature (< 400°C) for back-end dielectrics. MOCVD: metal-organic precursors for III-V.\nAtomically thin ALD (Atomic Layer Deposition): self-limiting monolayer reactions → angstrom-precision thickness and conformality. Used for high-k gate dielectric (HfO₂) and barrier metals (TaN, TiN).\nKey films: SiO₂ (TEOS precursor, ILD), Si₃N₄ (etch stop), poly-Si (gates), W (contact fill), Cu (dual-damascene, ECD then CMP).\nStep coverage: LPCVD excellent (~100%), sputtering poor (~50% in high AR via). ALD ~100%.\nFilm properties: density, stress (tensile/compressive), wet/dry etch rate, refractive index (n), dielectric constant (k).',
  },
  igbt: {
    summary: 'Insulated Gate Bipolar Transistor combines MOSFET gate control with BJT current conduction for high-voltage power switching',
    explanation: 'IGBT: gate-controlled as MOSFET (high input impedance), but p+ collector injects minority carriers into n-base → conductivity modulation → lower on-state voltage than power MOSFET at high voltages (> 600 V).\nVCE_sat ≈ 1.5–3 V at rated current. Power MOSFET Vdrop = ID·RDS_on → high RDS_on at high voltage.\nTurn-off: minority carrier tail current due to stored charge in n-base. Tradeoff: faster turn-off (less stored charge) = higher Vce_sat.\nRuggedness: IGBT can handle short-circuit for ~10 μs. Desaturation detection protects from overcurrent.\nApplications: motor drives (1–10 kW EV inverters), industrial inverters, welding, induction heating, HVDC (up to 6.5 kV).\nSiC MOSFET vs. IGBT: SiC faster switching (lower switching losses), suitable > 10 kHz; IGBT better at 400 Hz–20 kHz, lower cost.',
  },
  power_mosfet: {
    summary: 'High-voltage MOSFET optimized for low RDS(on) and fast switching in power conversion applications',
    explanation: 'Power MOSFET (vertical DMOS): current flows vertically from drain (back) through body/channel to source (front). Handles 20 V–1000 V.\nRDS(on): channel + drift region + contact resistance. Drift region resistance dominant at high voltage: RDS_on ∝ V_BR^2.5.\nFigure of merit: RDS_on × Qg (gate charge). Lower = better for high-frequency switching.\nGate charge components: Qgs, Qgd (Miller charge, dominates switching loss), Qg_total. Qgd plateau on Vgs(t) waveform.\nBody diode: inherent parasitic PiN diode. Slow reverse recovery (trr) causes losses; use Schottky in parallel for synchronous rectification.\nSuperjunction MOSFET (CoolMOS): alternating n/p columns in drift region → RDS_on ∝ V_BR^1.3 instead of 2.5. Better FOM.\nSiC MOSFET: wide bandgap (3.26 eV), 10× higher E-field → much lower RDS_on·area at same voltage. 650 V SiC vs. Si at 200 kHz.',
  },
  gate_oxide_reliability: {
    summary: 'Thin gate dielectric degrades under electric field stress causing TDDB, NBTI, and eventual oxide breakdown',
    explanation: 'TDDB (Time-Dependent Dielectric Breakdown): sustained Eox field generates oxide traps → progressive damage → hard breakdown (conduction path).\nWeibull distribution models TDDB lifetime. Acceleration models: E-model (ln(tBD) ∝ −γ·Eox) or 1/E-model.\nLifetime: 10-year target at VNOM. Verified by accelerated stress at elevated voltage and temperature.\nNBTI (Negative Bias Temperature Instability): PMOS with negative Vgs at elevated T → interface traps and oxide traps → ΔVth, Δgm.\nNBTI recovery: partial recovery when stress removed → dynamic NBTI complicates measurement. AC stress less severe than DC.\nPBTI (Positive Bias): NMOS with high-k gate, electrons trapped. Channel hot carrier (CHC): energetic carriers damage interface near drain.',
  },
  nbti_degradation: {
    summary: 'NBTI shifts PMOS threshold voltage under negative gate bias at high temperature, gradually degrading circuit performance',
    explanation: 'NBTI mechanism: Si–H bonds at Si/SiO₂ interface break under hole inversion + elevated temperature → interface traps (Nit) + oxide fixed charge.\nΔVth ∝ t^n, n ≈ 0.16–0.25 (power-law). Accelerated by high temperature and gate voltage: ΔVth ∝ exp(−Ea/kT)·Eox^m.\nRecovery: when gate voltage removed, hydrogen back-diffuses, partially passivates traps. Reaction-diffusion model predicts recovery.\nCircuit impact: PMOS in critical path slows → setup time violation over chip lifetime (10 years at 125°C).\nAging-aware design: guard-band Vth shift (typically 50–100 mV over lifetime), use high-Vt cells in critical paths, reduce PMOS duty cycle.\nMitigation: oxynitride gate (SiON) more resistant than SiO₂; high-k/metal gate reduces field; limit operating temperature.',
  },
  depletion_mosfet: {
    summary: 'Depletion-mode MOSFET has pre-existing channel at Vgs=0; requires negative Vgs to turn off (unlike enhancement-mode)',
    explanation: 'Depletion MOSFET: n-channel formed by ion implantation in channel region during fabrication → channel exists at Vgs = 0.\nTransfer curve: channel current at Vgs = 0 is non-zero (IDSS). Negative Vgs depletes channel → turn off at Vth < 0.\nN-channel depletion: Vth typically −1 to −5 V. Can operate as enhancement (Vgs > 0) or depletion (Vgs < 0).\nCircuit use: constant-current source (Vgs = 0, self-biased), voltage regulator, normally-on switch.\nGaN HEMT: depletion-mode by default (normally-on). Safety concern in power circuits → p-GaN gate or cascode with Si MOSFET to make normally-off.\nJFET: related device; uses PN junction gate instead of insulated gate. Vgs controls depletion of channel. No gate oxide → robust.',
  },
  jfet: {
    summary: 'Junction FET uses reverse-biased PN gate junction (not insulated gate) to modulate channel current; normally-on',
    explanation: 'JFET: n-channel JFET has p-type gate surrounding n-channel. Gate reverse biased → depletion widens → channel pinches off.\nPinch-off voltage VP: gate voltage at which channel fully depleted. For n-JFET: VP < 0 (typically −1 to −10 V).\nID = IDSS·(1 − VGS/VP)² in saturation. IDSS: maximum current at VGS = 0.\ngm = 2·IDSS/VP·(1 − VGS/VP) = 2√(IDSS·ID)/|VP|.\nGate leakage: JFET gate draws only nA (reverse junction leakage) → high input impedance. No gate oxide → no oxide breakdown.\nNoise: JFETs have lower 1/f noise than MOSFETs → preferred in low-noise audio preamps, instrument front-ends.\nApplications: low-noise amplifiers, voltage-variable resistors, analog switches, SPICE model used for GaAs MESFET.',
  },
  transmission_gate: {
    summary: 'CMOS transmission gate (NMOS + PMOS in parallel) provides low-resistance bidirectional switch across full Vdd range',
    explanation: 'TG: NMOS and PMOS controlled by complementary signals (CLK, CLKb). NMOS passes 0→VDD−Vtn well; PMOS passes Vtn→VDD well. Together → full rail-to-rail conduction.\nOn-resistance: RON = RMOS_n ∥ RMOS_p. Relatively flat across voltage range (complementary characteristics cancel). Typical 500 Ω–5 kΩ.\nIsolation: when off, both FETs off → high isolation. Gate leakage of CMOS: pA range.\nApplication: multiplexers, analog switches (DG series chips), D-latch (TG + inverter pair), SRAM cell access.\nCharge injection: when TG turns off, channel charge redistributes to source/drain → voltage error on signal. Compensate with dummy TG or differential cancellation.\nSpeed: propagation delay = RON × CL. Faster than pass-transistor logic (uses only NMOS).',
  },
  sense_amplifier: {
    summary: 'High-speed differential amplifier in SRAM/DRAM that detects and amplifies tiny bit-line voltage differences during read',
    explanation: 'SRAM sense amplifier (SA): latch-type cross-coupled inverters. Enabled when bit-line pair develops small differential (50–200 mV).\nOperation: SA enable (SAE) activates → latch resolves differential exponentially. Regeneration time: τ = 1/(gm/C).\nSensitivity: detects < 50 mV differential. Speed: 1–4 ns for full resolution. Offset voltage limits minimum detectable ΔV.\nDRAM SA: single-ended bit line. Charge from cell capacitor Cs onto bit line Cbl. ΔV = Cs·(VDD/2)/(Cs+Cbl). Typical ΔV ≈ 100 mV.\nStatic latch SA: noise-robust but requires pre-charge. Dynamic SA (StrongARM): fast, low-power, used in ADC comparators.\nOffset compensation: auto-zero or chopper stabilization in precision comparators. SRAM: column-level offset cancellation.',
  },
  voltage_controlled_oscillator: {
    summary: 'VCO generates frequency proportional to control voltage; ring oscillator (digital) or LC-tank (low phase noise)',
    explanation: 'Ring VCO: N-stage inverter ring (N odd). Frequency = 1/(2N·td). td controlled by supply voltage or current starving.\nLC VCO: resonant tank (L, C) with negative resistance (cross-coupled MOSFET pair) to sustain oscillation.\nOscillation condition: total loop phase = 0° (360°) and loop gain ≥ 1 at resonance frequency f0 = 1/(2π√LC).\nPhase noise: fundamental Leeson model: L(Δf) = 10·log[(2FkT/Psig)·(f0/2Q·Δf)²]. Higher Q → lower phase noise.\nTuning range: Kvco (MHz/V). VCO in PLL: Kvco × loop filter → phase noise performance tradeoff with lock range.\nApplications: RF synthesizers (cellular, WiFi), clock generation PLLs (CPU, DDR), SERDES CDR (clock data recovery).',
  },

  // ── COMPUTER ARCHITECTURE (extended) ──────────────────────────
  memory_consistency_models: {
    summary: 'Memory consistency model defines the order in which memory operations appear to complete across multiple processors',
    explanation: 'Sequential Consistency (SC): all processors see same global order of memory operations. Simplest model; expensive to implement at high performance.\nTotal Store Order (TSO, x86): stores may be buffered → loads can bypass stores. STORE→LOAD reorder allowed; all others in order.\nRelaxed models (RISC-V RVWMO, ARM): most reorderings allowed; explicit fence/barrier instructions enforce ordering.\nMemory barriers: MFENCE (x86, all), SFENCE (stores), LFENCE (loads). ARM: DMB ISH, DSB, ISB.\nRelease-acquire: Release write (all prior ops visible) + Acquire read (no subsequent op reordered before) → C++ memory_order_release/acquire.\nLock-free data structures require careful barrier placement. Wrong ordering: ABA problem, visibility bugs.',
  },
  atomic_operations_cas: {
    summary: 'Compare-and-swap (CAS) atomically reads, compares, and conditionally writes a memory location without locks',
    explanation: 'CAS(addr, expected, new): if *addr == expected, write new, return success; else return failure with current value.\nx86: CMPXCHG instruction (lock prefix for multicore). ARM: LDXR/STXR (load-exclusive/store-exclusive) pair.\nFetch-and-add: atomically add to memory, return old value. XADD on x86. Used for counters, semaphores.\nABA problem: CAS can succeed incorrectly if value changes A→B→A between read and CAS. Fix: tagged pointers (version counter in high bits) or hazard pointers.\nLock-free stack push: CAS(top, old_top, new_node). Retry on failure. Progress guarantee: at least one thread makes progress.\nStamped references in Java (AtomicStampedReference), DCAS (double-word CAS) on some architectures prevent ABA.',
  },
  hardware_prefetching: {
    summary: 'CPU hardware prefetcher predicts future memory accesses and fetches cache lines early to hide DRAM latency',
    explanation: 'Prefetch reduces effective memory latency by overlapping fetch with computation.\nStream prefetcher: detects sequential or strided access pattern → issues prefetch N cache lines ahead. Effective for arrays, matrix rows.\nSpatial prefetcher: fetches adjacent cache lines within a page when any line in a region accessed.\nMarkov prefetcher: builds history table of address transitions → predicts next address after current. Handles irregular patterns.\nStride prefetcher: detects constant stride between accesses. For loops with stride-k array access.\nAggressiveness: prefetch distance D (how far ahead). Too small: useless. Too large: cache pollution, bandwidth waste.\nHardware vs. software prefetch: compiler inserts PREFETCHT0 instructions; hardware detects patterns automatically. Best: combine both.',
  },
  write_buffer: {
    summary: 'Write buffer decouples CPU from slow cache/memory write operations, allowing CPU to continue after posting a write',
    explanation: 'Write buffer: FIFO queue between CPU registers and cache. CPU writes post to buffer → continues immediately.\nCoalescing: multiple writes to same/adjacent cache line merged into one → reduces memory bandwidth.\nWrite-combining buffer (WC): special non-temporal writes (MOVNTDQ) bypass cache, fill WC buffer, write in bursts to DRAM. Good for streaming writes (frame buffer).\nStore-to-load forwarding: if load address matches pending store in write buffer → forward data directly, avoid cache read.\nHazard: load issued before older store to same address completes → memory disambiguation unit detects and stalls or forwards.\nMemory ordering: write buffer contents visible to local CPU (forwarding) but not yet to other CPUs → TSO visibility model.',
  },
  store_to_load_forwarding: {
    summary: 'CPU forwards data from store buffer directly to dependent load before store commits to cache, hiding store-load latency',
    explanation: 'STL forwarding: when load address matches a pending store in the store queue → bypass cache, get data from store buffer.\nCondition: same address, and store data width covers load width. Partial forwarding (byte within word) may cause penalty.\nMisprediction: if store address unknown yet (AGU computing), load may speculatively read stale value → squash on discovery.\nLatency: STL forwarding typically 4–7 cycles penalty vs. cache hit (1 cycle). Still much faster than full cache miss.\nMemory disambiguation: OoO CPU must track stores in program order. Memory ordering buffer (MOB) on Intel.\nViolation detection: if load forwarded then older store arrives with conflicting address → flush dependent instructions, re-execute.',
  },
  systolic_array: {
    summary: 'Regular grid of compute units that rhythmically pass data between neighbors, achieving high throughput for matrix operations',
    explanation: 'Systolic array: 2D grid of PEs (processing elements). Data flows rhythmically (like heartbeat) through rows and columns.\nMatrix multiply A×B: row of A streams horizontally, column of B flows vertically. Each PE accumulates partial products.\nKey property: each data element used multiple times as it passes through → high reuse → arithmetic intensity ∝ dimension N.\nTPU (Tensor Processing Unit, Google): 256×256 systolic array, 65536 MACs per cycle, 92 TOPS INT8.\nAdvantage: simple PE (just multiplier + accumulator), no cache needed (data flows through), very high area efficiency.\nLimitation: fixed dataflow → hard to adapt for sparse or irregular computation. Must tile large matrices to fit array.',
  },
  network_on_chip: {
    summary: 'On-chip interconnect network connecting dozens of cores and memory controllers using routers and packet switching',
    explanation: 'NoC (Network-on-Chip): replaces bus (non-scalable) with packet-switched mesh/torus/ring network on chip.\nTopologies: mesh (2D grid, simple), torus (wrap-around edges, lower diameter), ring (ARM CCI/CMN, low power), fat-tree (high bisection BW).\nRouter: N×N crossbar + flow control (credits or Wormhole). Pipeline stages: Route Computation → VC Allocation → Switch Allocation → Switch Traversal → Link Traversal.\nLatency: hop count × (router pipeline + link) cycles. Bandwidth: bisection BW = links × link BW / 2.\nCache coherence over NoC: directory protocol sends invalidations/data via NoC packets. Scalable to 100s of cores.\nExamples: ARM CMN-700 (mesh), Intel Xeon (ring to mesh transition at Skylake), AMD Infinity Fabric (mesh/NUMA ring).',
  },
  chiplet_design: {
    summary: 'Disaggregate monolithic SoC into separate chiplets connected via die-to-die interconnects, enabling heterogeneous integration',
    explanation: 'Chiplet: small die designed to be combined with other chiplets in a package. Each chiplet uses optimal process node.\nMotivation: monolithic dies limited by reticle size (~800 mm²), yield drops exponentially with area. Chiplets: better yield, mix nodes.\nInterconnects: EMIB (Intel, 2D bridge), CoWoS (TSMC, interposer), Foveros (Intel, 3D face-to-face). UCIe (Universal Chiplet Interconnect Express): open standard.\nBandwidth: die-to-die > package-to-package (shorter interconnects). UCIe dense: 16 Gbps/mm, low latency (~2 ns).\nExamples: AMD EPYC (up to 8 compute chiplets + I/O die), Intel Ponte Vecchio (47 tiles), Apple M-series (CPU + GPU + memory chiplets).\nChallenges: thermal management across dies, test complexity (known-good-die), signal integrity at die edge, design partitioning.',
  },
  three_d_ic_stacking: {
    summary: '3D IC stacking places multiple dies vertically connected by through-silicon vias (TSVs) for bandwidth and density',
    explanation: 'TSV (Through-Silicon Via): vertical copper pillar etched through silicon, enabling die-to-die connections with <1 μm pitch.\nBandwidth: 3D stacking achieves 10–100× more bandwidth density vs. package-level integration (HBM: 1024-bit bus).\nHBM (High Bandwidth Memory): 4–12 DRAM dies stacked on logic die via TSVs. HBM3: 819 GB/s per stack.\n2.5D: dies placed side-by-side on silicon interposer (passive or active). CoWoS: TSMC 2.5D with RDL interposer.\nFace-to-face bonding: flip top die → 3 μm Cu-Cu hybrid bonding. Face-to-back: TSV in bottom die.\nHybrid bonding: direct Cu-Cu bond (< 1 μm pitch) enables high density. Used in Sony image sensors, Intel Foveros Direct.\nChallenges: thermal: heat removal from buried dies. Stress: CTE mismatch. Test: KGD (known-good die) requirement.',
  },
  cxl_protocol: {
    summary: 'CXL (Compute Express Link) coherent interconnect over PCIe enables CPU to coherently access accelerator and memory',
    explanation: 'CXL: open industry standard built on PCIe physical layer (Gen5+). Three protocol types:\nCXL.io: PCIe-like, non-coherent I/O protocol.\nCXL.cache: device (GPU, FPGA) can cache host memory coherently. Device-side caches participate in CPU coherence domain.\nCXL.mem: host CPU accesses device-attached memory (CXL memory expansion) as if local DRAM. Enables memory pooling.\nLatency: CXL.mem ~100–300 ns (vs. local DRAM ~60 ns). Bandwidth: up to 64 GB/s (CXL 2.0, x16).\nCXL 3.0: peer-to-peer, fabric (multi-switch), shared memory pooling across multiple hosts.\nUsed in: AI/ML accelerator integration (GPU←→CPU coherent memory), memory expansion (cheaper DDR4/LPDDR4 pools), SmartNIC/DPU.',
  },
  cpu_power_states: {
    summary: 'CPU P-states scale frequency/voltage for performance; C-states idle cores progressively deeper for power savings',
    explanation: 'P-states (ACPI Performance States): run at different frequency + voltage pairs. P0 = highest (max Turbo), Pn = lowest performance.\nDVFS (Dynamic Voltage and Frequency Scaling): OS/hardware selects P-state based on load. Intel SpeedStep, AMD Cool\'n\'Quiet.\nTurbo Boost: exceed TDP briefly when thermal/power headroom available. Sustained = base frequency. Turbo lasts seconds to minutes.\nC-states (Idle States): C0 (active), C1 (halt, ~1 μs exit), C3 (sleep, ~100 μs exit), C6 (deep power-down, L3 flushed, ~1 ms exit), C8/C10.\nExit latency tradeoff: deeper C-state = more power savings but longer wake-up time. OS scheduler avoids deep C-states if soon-to-wake interrupt expected.\nPackage C-states: entire CPU package power down (PC8, PC10). DRAM: self-refresh mode during package C-states. Power savings: 80–95%.',
  },
  thermal_design_power: {
    summary: 'TDP is the maximum sustained power a CPU is designed to dissipate; cooling solution must maintain junction temperature below Tjmax',
    explanation: 'TDP (Thermal Design Power): heat generated by CPU at maximum sustained load. NOT peak power (can be 1.5–2× TDP short-term).\nThermal resistance: θJA = θJC (junction-to-case) + θCS (TIM) + θSA (heatsink-to-ambient). TJ = TA + P × θJA.\nTjmax: Intel 100°C, AMD 95°C. Throttling (reducing frequency) begins near Tjmax to protect chip.\nTIM (Thermal Interface Material): fills microscopic air gaps between die and heatsink. Paste (~4 W/m·K), indium (~80 W/m·K), solder.\nHeat spreader (IHS): spreads heat from small die area to larger heatsink contact area. Delidded CPUs for lower θJC.\nCooling: air (heatsink + fan, ~30°C/TDP), liquid (AIO, custom loop, ~20°C/TDP), phase-change (<10°C/TDP for HPC).\nTDP ≠ power consumption: idle power ≈ 5–15 W; TDP 65–300 W for desktop/server CPUs.',
  },
  instruction_level_parallelism: {
    summary: 'ILP is the inherent parallelism in a sequential instruction stream exploited by superscalar and OoO execution',
    explanation: 'ILP: number of independent instructions that can execute simultaneously. Limited by true data dependencies (RAW).\nDependence chains: critical path of dependent instructions determines minimum execution time regardless of issue width.\nAverage ILP: SPEC benchmarks ~4–8 for integer, higher for FP. But practical IPC limited by structural hazards, memory latency.\nILP extraction techniques: register renaming (eliminates WAR/WAW), dynamic scheduling (Tomasulo algorithm), branch prediction, value prediction.\nLimits: memory latency (load-dependent operations stall), branch misprediction flush, cache misses, register spill.\nCompiler ILP: loop unrolling, software pipelining, VLIW (Very Long Instruction Word, compiler schedules ILP statically — IA-64/Itanium).',
  },
  thread_level_parallelism: {
    summary: 'TLP exploits parallelism across multiple independent threads running on separate cores or hardware threads (SMT)',
    explanation: 'TLP: multiple threads execute concurrently on multiple cores or via hardware multithreading.\nMulti-core: N cores each with private L1/L2, shared L3. True parallel execution. Amdahl limits speedup.\nSMT (Simultaneous Multithreading, Intel Hyper-Threading): 2 hardware threads share one OoO core (share ROB, RS, execution units). Improves throughput by filling stall cycles of one thread with other thread\'s instructions.\nSMT vs. multi-core: SMT adds ~5% area for ~25% throughput gain (when threads complement each other). Multi-core: better isolation, consistent performance.\nThread synchronization: mutex, semaphore, condition variable. Lock contention limits TLP scaling.\nOpenMP, pthreads, Java threads, Go goroutines exploit TLP. NUMA-aware thread placement critical for performance.',
  },
  data_level_parallelism: {
    summary: 'DLP applies same operation to multiple data elements simultaneously using SIMD vectors or GPU warps',
    explanation: 'DLP: same computation on N data elements at once. Key form of parallelism in multimedia, ML, scientific computing.\nSIMD (CPU): 256-bit AVX2 → 8×float32 or 4×float64 in one instruction. AVX-512: 16×float32.\nGPU (SIMT): 32-thread warp executes same instruction. Thousands of threads → massive DLP for regular computation.\nVectorization conditions: no loop-carried dependencies, pointer aliasing resolved, loop count known or variable strides.\n#pragma omp simd, __builtin_ia32_addps(), or auto-vectorization with -O3 -march=native.\nHorizontal vs. vertical: vertical operations (add corresponding elements of two arrays) trivially vectorizable; horizontal (sum array) requires shuffle.\nDLP in ML: matrix multiply maps perfectly to GPU SIMT + tensor cores (FP16 Warp-Matrix ops).',
  },
  hardware_transactional_memory: {
    summary: 'HTM allows code regions to execute speculatively; hardware commits or rolls back atomically on conflict detection',
    explanation: 'HTM: programmer marks transaction begin/end. Hardware tracks read-set and write-set. On conflict (another core writes to read-set) → abort and retry.\nIntel TSX (Transactional Synchronization Extensions): RTM (XBEGIN/XEND) and HLE (LOCK-prefix elision). Withdrawn due to security bugs (TAA - TSX Asynchronous Abort).\nCapacity limit: transaction data must fit in L1/L2 cache. Eviction → abort.\nConflict detection: cache coherence protocol detects conflicting accesses → abort loser. Optimistic: assume no conflict, retry on abort.\nAbort reasons: conflicts, capacity overflow, interrupts, system calls, CPUID. Retry loop with fallback to lock after N failures.\nUse cases: concurrent data structures (hash tables, linked lists), lock elision for legacy locks. IBM POWER: HTM stable and deployed.\nPower9/z15: IBM hardware TM with unlimited capacity (software assist on overflow).',
  },
  near_memory_computing: {
    summary: 'Processing-in-Memory (PIM) places compute units near or inside DRAM to reduce data movement energy and latency',
    explanation: 'Memory wall: data movement between CPU and DRAM accounts for 40–60% of total energy in data-center workloads.\nNear-memory compute: add compute logic near DRAM (in DRAM package or interposer). Examples: Micron Automata Processor, Samsung HBM-PIM.\nProcessing-in-Memory: logic inside DRAM die (uses modified DRAM process → limited transistor density). Or: 3D-stacked logic die below DRAM.\nBandwidth advantage: in-DRAM bandwidth = internal DRAM bandwidth (TB/s) vs. external bus (100s GB/s). 10–100× more bandwidth.\nUse cases: graph analytics (irregular memory access), genome processing, database operations, sparse ML inference.\nChallenges: programmability (new ISA extensions), memory consistency with CPU, DRAM process constraints limit compute complexity.\nSamsung Aquabolt HBM-PIM: 16 PIM cores per HBM die, 2× ML bandwidth improvement vs. standard HBM.',
  },
  neuromorphic_computing: {
    summary: 'Brain-inspired computing using spiking neural networks (SNNs) and event-driven hardware for ultra-low-power AI',
    explanation: 'Neuromorphic chips: implement spiking neurons and synapses in hardware. Event-driven: only active on spikes → low average power.\nSpiking Neural Networks (SNN): neurons fire binary spikes when membrane potential exceeds threshold. Temporal coding carries information in spike timing.\nIBM TrueNorth: 4096 neurosynaptic cores, 256 neurons each, 1 million neurons, 70 mW total power.\nIntel Loihi 2: 1M neurons, on-chip learning (STDP), reconfigurable. Loihi 2: 8× more efficient than GPU for sparse inference.\nLearning: Spike-Timing-Dependent Plasticity (STDP) — local learning rule. Harder to train than gradient-descent DNNs.\nAdvantages: extremely low power (μW–mW range), temporal processing, event-driven video/audio.\nChallenges: programming models immature, accuracy lower than DNN for complex tasks, no standard toolchain.',
  },
  approximate_computing: {
    summary: 'Intentional introduction of controlled inaccuracies in computation to trade off result quality for energy and performance',
    explanation: 'Approximate computing: exploit error tolerance of applications (image/video, machine learning, sensor data) to reduce compute cost.\nVoltage overscaling: run circuits below Vmin → timing errors → ~50% energy savings. ECC or selective protection for critical parts.\nPrecision scaling: use 8-bit instead of 32-bit FP for ML inference. INT8 → 4× compute density, 4× memory efficiency.\nNeural processing: quantization (INT8/INT4/binary weights), pruning (zero out < threshold weights), distillation. Minimal accuracy loss on large models.\nApproximate memory: allow DRAM to refresh less often → some bit errors. DRAM at 2× refresh interval: 30% power savings, error rate manageable with ECC.\nMemoization: cache results of expensive functions; return cached result for close inputs (spatial memoization). Used in graphics, physics simulation.\nKey metric: Quality of Service (QoS) vs. energy efficiency Pareto curve.',
  },
  rdma_networking: {
    summary: 'RDMA allows one machine to directly read/write another\'s memory without involving the remote CPU, achieving μs latency',
    explanation: 'RDMA (Remote Direct Memory Access): zero-copy, kernel-bypass data transfer between machines.\nProtocols: InfiniBand (IB, purpose-built RDMA), RoCE (RDMA over Converged Ethernet v2, 25/100/200 GbE), iWARP (TCP/IP).\nVerbs API: ibv_post_send(), RDMA Write (no remote CPU involvement), RDMA Read, Send/Receive (two-sided).\nLatency: InfiniBand ~1–2 μs; RoCE ~3–5 μs. vs. TCP/IP ~50–100 μs. Critical for HPC MPI and distributed ML.\nMPI over RDMA: MPI_Send/Recv maps to RDMA verbs → high-bandwidth (400 Gb/s InfiniBand HDR) ML training.\nGPUDirect RDMA: NIC transfers data directly to GPU memory via PCIe P2P, bypassing CPU and host memory.\nCongestion control: RoCE requires lossless fabric (PFC pause frames) or ECN-based DCQCN algorithm to prevent packet drops.',
  },
  load_store_unit: {
    summary: 'LSU executes load/store instructions: computes effective address, accesses cache, and manages memory ordering',
    explanation: 'LSU (Load-Store Unit) components: AGU (Address Generation Unit), TLB, L1 D-cache, load queue, store queue/buffer.\nLoad pipeline: AGU computes EA → TLB translate → L1 D-cache tag + data → forwarding check → writeback to register file.\nStore pipeline: AGU compute → write to store queue (speculative) → commit from ROB → write to L1 cache (or write buffer).\nLoad queue: holds all in-flight loads (speculative). On memory ordering violation → detect and squash.\nStore-to-load forwarding: load checks store queue for matching addresses → can receive data without cache access.\nMemory ordering: OoO loads may execute before older stores. Requires post-execute ordering check. x86 enforces TSO: no load-load or store-store reordering.\nModern CPUs: 2–3 load ports + 1–2 store ports per cycle. Apple M-series: 4 load + 2 store ports.',
  },
  register_file: {
    summary: 'Physical register file holds operands for in-flight instructions; much larger than architectural ISA register count due to renaming',
    explanation: 'Architectural registers: ISA-visible (x86: 16 integer + 16 FP; ARM64: 31 integer + 32 FP). Each has a name in the ISA.\nPhysical register file (PRF): much larger (192–512 entries) to support register renaming. Free list tracks available physical registers.\nRegister renaming: each instruction write allocates new physical register from free list. Old mapping → RAT (Register Alias Table).\nRAT (Register Alias Table): maps architectural register → physical register currently holding "live" value.\nFreeing: physical register freed when instruction commits AND new write to same architectural register commits.\nBanking: PRF may be banked to support multiple read/write ports per cycle. Read ports = instruction issue width × operands per instr.\nRegfile size bottleneck: wider OoO machines need more physical registers → area and access latency tradeoffs.',
  },
  micro_op_cache: {
    summary: 'Decoded micro-op cache (μop cache) stores pre-decoded instructions to skip the front-end decode stage on cache hits',
    explanation: 'μop cache (Decoded Instruction Cache, DIC): caches CISC instructions after decoding into μops.\nIntel Sandy Bridge+: 1536-entry μop cache (DSB - Decoded Stream Buffer). 6 μops/cycle delivered when hit.\nBenefit: bypass complex CISC legacy decoders → higher sustained bandwidth, lower power, shorter pipeline.\nHit rate: typically 80–95% for integer workloads. Miss → fall back to legacy decode pipeline.\nAMD: Op cache since Zen1, up to 4096 μops (Zen4). ARM/RISC: less need (fixed-width instructions decode fast).\nBranch handling: branch target predictions must match μop cache entries. Aliasing in μop cache causes mis-speculation.\nLoop streaming: when loop fits in μop cache → loop stream detector locks fetch to μop cache → maximum efficiency.',
  },
  loop_stream_detector: {
    summary: 'Loop Stream Detector (LSD) recognizes small loops fitting in μop queue and streams them without repeated fetch/decode',
    explanation: 'LSD: detects loops with ≤ N unique μops (Intel: 57–64 μops) executing repeatedly without exits.\nOnce detected: μops recycled from μop queue, fetch and decode stages power-gated (clock-gated) → power savings.\nLatency: first iteration normal; subsequent iterations: μops dispatched directly from loop buffer.\nBenefit: ~15–20% power reduction for loop-heavy code. Eliminates decode bottleneck for tight loops.\nISB (Instruction Streaming Buffer): similar concept. Some microarchitectures call it loop buffer.\nLimitations: branch misprediction exits loop → LSD resumes normal fetch. Loop with function calls may not qualify.\nIntel: LSD disabled in some Skylake steppings due to erratum. AMD: separate loop buffer with similar function.',
  },
  hardware_multithreading: {
    summary: 'Hardware multithreading shares a processor core among multiple threads to utilize stall cycles from one thread with another',
    explanation: 'Coarse-grained MT: switch thread on cache miss (long stall). Simple, low overhead, wastes short stalls.\nFine-grained MT: switch every cycle in round-robin. Hides short stalls. Used in GPU (warp scheduling) and some SPARC CPUs.\nSMT (Simultaneous Multithreading): multiple threads issue instructions every cycle. Shared execution units, private register files, ROB partitioned.\nIntel Hyper-Threading (HT): 2-way SMT on each core. Two hardware thread contexts (register files, ROBs). Share caches, execution units.\nPerformance: HT improves throughput 15–30% when threads complement (one memory-bound + one compute-bound). Can hurt single-threaded latency.\nSecurity: SMT shares cache, TLB, BTB → side-channel attacks (Spectre-SMT, MDS). Mitigation: disable SMT or flush microarchitectural state on context switch.',
  },
  memory_mapped_io: {
    summary: 'MMIO maps peripheral registers into CPU address space so load/store instructions directly control hardware without special I/O instructions',
    explanation: 'MMIO: processor bus address ranges assigned to peripheral control registers instead of DRAM. MOV to address → write to peripheral.\nAlternative: Port-mapped I/O (PMIO): separate I/O address space (x86 IN/OUT instructions). Legacy; limited to 64K ports.\nUncacheable: MMIO regions marked non-cacheable in page tables (PAT/MTRR on x86). Writes must reach device, not be cached.\nOrdering: MMIO writes must complete in order. Memory barrier (MFENCE, ST fence) ensures prior writes visible before MMIO.\nBar (Base Address Register): PCIe device advertises BAR size in config space → OS maps to MMIO region → driver uses pointer.\nExamples: GPU MMIO registers (doorbell, control regs), UART TX/RX registers, GIC distributor registers (ARM), GPIO control.',
  },
};
