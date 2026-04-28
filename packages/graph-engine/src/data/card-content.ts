// ============================================================
// Core knowledge content for practice cards
// summary  — one-sentence definition of what it IS
// explanation — key formula / theorem / rule + core insight
// ============================================================

export const CARD_CONTENT: Record<string, { summary: string; explanation: string }> = {

  // ── LINEAR ALGEBRA ────────────────────────────────────────────
  linear_algebra: {
    summary: 'A basis is a minimal set of independent vectors that spans a vector space',
    explanation: 'Every vector in the space has a unique coordinate representation in a chosen basis.\nChanging basis changes coordinates, not the underlying vector.\nThis is the concrete idea behind matrix representations, PCA directions, embeddings, and linear model features.',
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
    explanation: 'U (m×m), V (n×n) orthogonal; Σ diagonal with σ₁ ≥ σ₂ ≥ … ≥ 0.\nRank-k approximation: keep top-k singular values → best low-rank approx (Eckart-Young).\nUsed in PCA, pseudoinverse, latent semantic analysis, recommender systems.',
  },
  matrix_inverse: {
    summary: 'A^{-1} such that AA^{-1} = I; exists iff det(A) ≠ 0',
    explanation: 'In numerical work, solve Ax = b with LU/QR/SVD instead of explicitly forming A^{-1}.\n2×2: [[d, -b], [-c, a]] / (ad-bc). Condition number κ = σ_max/σ_min measures numerical stability.',
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
    summary: 'A random variable maps outcomes to values and is fully described by its distribution',
    explanation: 'Discrete variables use a PMF P(X=x); continuous variables use a PDF f(x) and CDF F(x)=P(X<=x).\nExpectation and variance summarize the distribution, while conditioning updates it with evidence.\nThis is the core object behind datasets, likelihoods, Bayesian updates, and uncertainty-aware ML.',
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
    explanation: 'p-value = P(data at least as extreme | H₀ true). Reject H₀ if p < α.\nType I error: false positive/reject H₀ when true (rate = α). Type II error: false negative/fail to reject H₀ when false (rate = β).\nPower = 1−β. t-test, χ² test, ANOVA are common instances.',
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
    summary: 'An objective function turns a goal into a scalar value that an algorithm can minimize or maximize',
    explanation: 'Training usually means choosing parameters θ that minimize loss L(θ).\nAt an unconstrained optimum, ∇L(θ*) = 0; with convex objectives, any local minimum is global.\nThis concept connects gradient descent, constraints, regularization, and model fitting.',
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
    summary: 'A derivative is the local linear rate of change of a function at a point',
    explanation: 'For one variable, df/dx is the slope of the best local line.\nFor many variables, partial derivatives assemble into the gradient, the direction of steepest increase.\nThis is the concrete concept used by backpropagation, sensitivity analysis, and numerical optimization.',
  },
  partial_derivatives: {
    summary: '∂f/∂x_i: rate of change of f w.r.t. x_i, holding all other variables constant',
    explanation: 'Gradient ∇f = [∂f/∂x_1, …, ∂f/∂x_n].\nSecond partials ∂²f/∂x_i∂x_j form the Hessian matrix.\nClairaut\'s theorem: mixed partials are equal when continuous.',
  },
  chain_rule: {
    summary: 'd/dx f(g(x)) = f\'(g(x))·g\'(x) — the fundamental rule for differentiating compositions',
    explanation: 'Multivariate: ∂z/∂t = Σ_i (∂z/∂x_i)(∂x_i/∂t).\nBackpropagation is the chain rule applied recursively on computational graphs.\nEssential for every gradient computation in deep learning.',
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
    summary: 'Algorithmic complexity predicts how runtime or memory grows as input size increases',
    explanation: 'Big-O abstracts away constants to compare growth rates: O(log n), O(n), O(n log n), O(n^2).\nA good algorithm is not just correct; it stays feasible as n grows.\nThis concept explains why binary search, hashing, dynamic programming, and graph algorithms matter in practice.',
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
    explanation: 'Works when: greedy-choice property + optimal substructure.\nExamples that work: Huffman coding, Prim\'s/Kruskal\'s MST, activity selection, fractional knapsack.\nDoes not always work: 0/1 knapsack, coin change with arbitrary denominations.',
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
    summary: 'Deep models learn hierarchical representations by composing many nonlinear layers',
    explanation: 'Each layer transforms the previous representation into features useful for the task.\nEarly layers often capture simple patterns, while later layers combine them into task-specific abstractions.\nThis is the concrete mechanism behind CNNs, transformers, representation learning, and transfer learning.',
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
  kv_cache: {
    summary: 'KV cache stores past attention keys and values so autoregressive decoding does not recompute the full prefix',
    explanation: 'During generation, each new token only needs a fresh query; previous keys and values are reused from cache.\nThis reduces per-token work from recomputing the whole sequence to attending over cached state.\nThe tradeoff is memory: cache size grows with layers, heads, sequence length, batch size, and hidden dimension.',
  },
  paged_attention: {
    summary: 'Paged attention stores KV cache in fixed-size memory blocks so serving can reuse memory without large contiguous allocations',
    explanation: 'Long LLM requests have variable-length KV caches, which causes fragmentation and wasted GPU memory.\nPaged attention treats KV cache like virtual memory pages: logical token positions map to physical cache blocks.\nThis enables higher throughput serving, efficient batching, and cheaper handling of many concurrent generations.',
  },
  flash_attention_advanced: {
    summary: 'Flash attention computes exact attention with tiling to minimize high-bandwidth memory reads and writes',
    explanation: 'Standard attention materializes the full n by n score matrix, which is memory-expensive.\nFlash attention streams Q, K, and V through SRAM-sized tiles and maintains online softmax statistics.\nIt preserves exact attention while reducing memory traffic, making long-context training and inference faster.',
  },
  rotary_position_embeddings: {
    summary: 'RoPE encodes token position by rotating query and key vectors so attention depends on relative offsets',
    explanation: 'Instead of adding a position vector, RoPE applies a position-dependent rotation to Q and K dimensions.\nThe dot product between rotated vectors naturally includes relative position information.\nThis is why many decoder LLMs use RoPE for length generalization and stable causal attention.',
  },
  grouped_query_attention: {
    summary: 'Grouped-query attention shares key-value heads across groups of query heads to reduce KV cache memory',
    explanation: 'Multi-head attention gives each query head its own K and V heads; multi-query attention shares one K/V set.\nGrouped-query attention is the middle ground: several query heads share one K/V group.\nIt preserves much of MHA quality while improving decoding speed and lowering memory pressure.',
  },
  sliding_window_attention: {
    summary: 'Sliding window attention restricts each token to a local context window to make long sequences cheaper',
    explanation: 'Full attention costs O(n^2) because every token attends to every other token.\nA sliding window lets each token attend only to nearby tokens, reducing compute and memory toward O(nw).\nGlobal tokens, recurrence, or retrieval are often added when the model still needs long-range information.',
  },
  speculative_decoding: {
    summary: 'Speculative decoding uses a small draft model to propose tokens that a larger model verifies in parallel',
    explanation: 'The draft model cheaply generates several candidate next tokens.\nThe target model evaluates those candidates in one parallel pass and accepts the longest valid prefix.\nWhen the draft is accurate, generation becomes faster without changing the target model distribution.',
  },
  continuous_batching: {
    summary: 'Continuous batching keeps an inference batch full by adding and removing requests at token boundaries',
    explanation: 'Static batching waits for all requests in a batch to finish, wasting GPU slots on short or completed generations.\nContinuous batching schedules active sequences every decoding step and admits new requests as others finish.\nIt is a core serving technique for high-throughput LLM APIs.',
  },
  mixture_of_experts_routing: {
    summary: 'MoE routing activates only a small subset of expert feed-forward networks for each token',
    explanation: 'A router scores experts and sends each token to the top-k experts, often k=1 or k=2.\nThis increases total parameter count without activating all parameters per token.\nThe hard parts are load balancing, routing stability, expert capacity, and distributed all-to-all communication.',
  },
  lora_adapters: {
    summary: 'LoRA fine-tunes a model by learning low-rank update matrices instead of changing the full weight matrix',
    explanation: 'For a frozen weight W, LoRA learns a small update delta W = BA where rank r is much smaller than model dimension.\nOnly the adapter weights train, which reduces memory and allows multiple task adapters per base model.\nAt inference, LoRA updates can be merged into the base weights or loaded dynamically.',
  },
  rlhf_preference_modeling: {
    summary: 'Preference modeling trains a reward model from ranked responses so an LLM can optimize for human preference',
    explanation: 'Humans compare candidate answers; the reward model learns which response is preferred.\nRLHF then adjusts the policy to increase reward while staying close to the base model.\nThis is a concrete alignment mechanism, but it can over-optimize reward model blind spots if not monitored.',
  },
  retrieval_augmented_generation: {
    summary: 'RAG retrieves external documents at generation time and conditions the model on that evidence',
    explanation: 'A retriever selects relevant chunks from a knowledge base, then the generator uses them in the prompt or context.\nThis separates factual memory from model weights and makes updates cheaper than retraining.\nThe main failure modes are poor chunking, weak retrieval, missing citations, and the model ignoring evidence.',
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
    summary: 'Entropy H(X) measures the average uncertainty or surprise in a random variable',
    explanation: 'For a discrete variable, H(X) = -Σ p(x) log p(x).\nHigher entropy means outcomes are harder to predict; lower entropy means probability mass is concentrated.\nEntropy connects compression, decision trees, mutual information, KL divergence, and cross-entropy loss.',
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
  six_transistor_sram_cell: {
    summary: 'A 6T SRAM cell stores one bit using two cross-coupled inverters plus two access transistors',
    explanation: 'The cross-coupled inverters form a bistable latch: one internal node is high while the other is low.\nWordline enables the two access transistors, connecting the cell to complementary bitlines BL and BLB.\nThe 6T cell is fast and stable enough for CPU caches, but it costs much more area than a DRAM bitcell.',
  },
  sram_read_write_margins: {
    summary: 'SRAM margins measure whether a bitcell can be read without flipping and written without failing',
    explanation: 'Read static noise margin checks that connecting the cell to precharged bitlines does not disturb the stored value.\nWrite margin checks that the write drivers can overpower the cell inverters and flip the bit.\nProcess variation, low voltage, and transistor sizing trade off read stability, write ability, leakage, and area.',
  },
  sram_sense_amplifier: {
    summary: 'An SRAM sense amplifier detects a tiny voltage difference between complementary bitlines and resolves it to a logic value',
    explanation: 'Before a read, BL and BLB are precharged high; the selected cell weakly discharges one side.\nThe sense amplifier turns a small differential voltage into a full-swing digital 0 or 1.\nGood sense-amp design reduces read latency and bitline energy, which dominate large cache arrays.',
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
  cache_tag_index_offset: {
    summary: 'A cache address splits into tag, index, and block offset to locate and validate cached data',
    explanation: 'The offset selects a byte within a cache line, the index selects a set, and the tag verifies which memory block is stored there.\nOn a lookup, the cache reads all ways in the indexed set and compares tags in parallel.\nThis decomposition explains conflict misses, cache line size effects, and why alignment matters.',
  },
  set_associative_cache: {
    summary: 'A set-associative cache maps each memory block to one set but allows it to occupy any way in that set',
    explanation: 'Direct-mapped caches have one possible location per block; fully associative caches allow any location.\nSet associativity is the practical middle ground: fewer conflict misses than direct-mapped with lower cost than fully associative.\nReplacement policy decides which way to evict when all ways in a set are full.',
  },
  write_back_cache_policy: {
    summary: 'A write-back cache updates lower memory only when a dirty cache line is evicted',
    explanation: 'Writes update the cache line and set a dirty bit instead of immediately writing DRAM.\nThis reduces memory bandwidth for repeated writes to the same line, but eviction becomes more complex.\nWrite-back caches need coherence and ordering rules so other cores and devices see correct data.',
  },
  victim_cache: {
    summary: 'A victim cache is a small buffer that catches recently evicted cache lines to reduce conflict misses',
    explanation: 'When an L1 line is evicted, it moves into the victim cache instead of being discarded immediately.\nIf the processor soon accesses that line again, the victim cache supplies it faster than the next cache level.\nThis is especially useful for direct-mapped or low-associativity caches with recurring index conflicts.',
  },
  last_level_cache_llc: {
    summary: 'The last-level cache is the final on-chip cache before requests go to DRAM or external memory',
    explanation: 'LLC is usually shared across cores and absorbs misses from private L1/L2 caches.\nIt reduces off-chip bandwidth demand and can act as a coherence point for multicore systems.\nLLC design trades capacity, latency, associativity, slice hashing, and fairness between cores.',
  },
  system_level_cache: {
    summary: 'A system-level cache sits beyond CPU clusters to cache memory traffic from CPUs, GPUs, NPUs, and DMA engines',
    explanation: 'SoCs often have many masters sharing DRAM: CPU cores, GPU, display, camera ISP, modem, and accelerators.\nA system-level cache reduces DRAM bandwidth and power by capturing shared or reused data across the whole chip.\nIt must handle QoS, coherency domains, security attributes, and traffic from devices that may not use CPU caches.',
  },
  scratchpad_memory: {
    summary: 'Scratchpad memory is software-managed on-chip SRAM used when predictable latency matters more than automatic caching',
    explanation: 'Unlike a cache, a scratchpad does not decide what to keep; software or DMA explicitly moves data in and out.\nThis removes cache miss unpredictability and tag overhead, which is valuable in DSPs, GPUs, and real-time systems.\nThe cost is programmability: kernels must tile data and orchestrate transfers carefully.',
  },
  memory_controller_scheduling: {
    summary: 'A memory controller schedules DRAM commands to balance row-buffer locality, latency, bandwidth, and fairness',
    explanation: 'DRAM access is organized into banks, rows, and columns; an open row can be served faster than a closed-row miss.\nSchedulers often prioritize row hits but must avoid starving other cores or real-time devices.\nGood controllers manage refresh, bank conflicts, read/write turnarounds, QoS, and power states.',
  },
  cache_prefetcher_design: {
    summary: 'A cache prefetcher predicts future memory accesses and fetches lines before the CPU demands them',
    explanation: 'Stride prefetchers learn regular address deltas; stream prefetchers detect sequential access; spatial prefetchers fetch neighboring lines.\nA useful prefetch arrives early enough to hide latency without evicting valuable data.\nBad prefetching wastes bandwidth, pollutes caches, and can hurt latency-sensitive workloads.',
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
  // ── SIGNAL PROCESSING (extended) ─────────────────────────────────
  dft_algorithm: {
    summary: 'DFT decomposes N-point discrete signal into N complex frequency bins via matrix multiplication or FFT butterfly',
    explanation: 'DFT: X[k] = Σ x[n]·e^(−j2πkn/N), n=0..N−1. Computational cost O(N²) direct; O(N log N) via FFT.\nFFT (Cooley-Tukey, 1965): radix-2 decimation-in-time (DIT). Recursively split into even/odd sub-DFTs → butterfly ops.\nTwiddle factor: W_N^k = e^(−j2πk/N). Butterfly: X = A + W·B, Y = A − W·B. Bit-reversal permutation reorders input.\nSpectral resolution: Δf = fs/N. Frequency bins: 0, fs/N, 2fs/N, ..., (N−1)fs/N. Useful spectrum: 0..fs/2 (Nyquist).\nZero-padding: append zeros → denser frequency grid (interpolation in frequency domain), not more resolution.\nApplications: spectrum analysis, fast convolution (overlap-add/overlap-save), OFDM modulation, filter design.',
  },
  dtft_transform: {
    summary: 'DTFT maps discrete-time sequence to continuous periodic frequency spectrum; foundation for DFT and z-transform',
    explanation: 'DTFT: X(e^jω) = Σ x[n]·e^(−jωn), ω ∈ [−π, π]. Always periodic with period 2π.\nInverse DTFT: x[n] = (1/2π)∫X(e^jω)e^(jωn)dω.\nRelation to z-transform: DTFT = z-transform evaluated on unit circle z = e^jω.\nDFT samples DTFT at N equally spaced frequencies: X[k] = X(e^j2πk/N).\nConvergence: requires Σ|x[n]| < ∞ (absolutely summable) or x[n] in L2.\nKey pairs: rect window ↔ Dirichlet kernel; δ[n] ↔ 1; a^n·u[n] ↔ 1/(1−ae^(−jω)) for |a|<1.',
  },
  z_transform: {
    summary: 'Bilateral z-transform converts discrete-time sequences to complex polynomial in z; enables pole-zero analysis',
    explanation: 'Z-transform: X(z) = Σ x[n]·z^(−n). Unilateral: sum from n=0 (for causal systems with ICs).\nROC (Region of Convergence): set of z where series converges. Causal stable: ROC outside outermost pole ring.\nPole-zero analysis: system function H(z) = B(z)/A(z). Poles inside unit circle → stable. |z|=1 → DTFT.\nProperties: delay z^(−1), convolution → multiplication, time-reversal z^(−1)→z.\nPartial fractions for inverse: X(z)/z = Σ Ak/(z−pk). Combine with ROC to determine sequence.\nCommon pairs: u[n] ↔ z/(z−1), a^n·u[n] ↔ z/(z−a), δ[n] ↔ 1.',
  },
  bilinear_transform_signal: {
    summary: 'Maps analog prototype filter s-plane to digital z-plane via s = (2/T)·(z−1)/(z+1), warping frequency axis',
    explanation: 'Bilinear transform (Tustin): s = (2/T)·(z−1)/(z+1). Maps jΩ axis to unit circle exactly → no aliasing.\nFrequency warping: digital frequency ω = 2·arctan(Ω·T/2). Pre-warp critical frequencies before mapping.\nMaps stable analog poles (Re(s)<0) to stable digital poles (|z|<1). All-pole analog → all-pole digital.\nDesign procedure: 1. Specify digital frequencies ωd. 2. Pre-warp: Ωa = (2/T)·tan(ωd/2). 3. Design analog prototype. 4. Apply bilinear transform.\nOrder preservation: N-pole analog → N-pole digital. Extra zeros added at z=−1 for bandpass/highpass.\nUsed for Butterworth, Chebyshev, elliptic IIR design via bilinear mapping from analog prototype.',
  },
  windowing_functions: {
    summary: 'Window functions taper time-domain segments to reduce spectral leakage at cost of mainlobe widening',
    explanation: 'Spectral leakage: finite-length DFT assumes periodic extension → discontinuities at boundaries → sidelobes.\nRectangular window: no taper. Mainlobe width 4π/N, sidelobes −13 dB. Best frequency resolution, worst leakage.\nHann (Hanning): w[n] = 0.5(1−cos(2πn/N)). Sidelobes −31 dB, mainlobe 8π/N. Good general purpose.\nHamming: w[n] = 0.54−0.46cos(2πn/N). Peak sidelobe −41 dB. Good speech processing.\nBlackman: 3-term cosine. Sidelobes −57 dB, wider mainlobe. Good dynamic range applications.\nKaiser window: parameter β trades off mainlobe width vs sidelobe level continuously. Optimal for given constraints.',
  },
  stft_spectrogram: {
    summary: 'Short-Time Fourier Transform computes time-varying spectrum by applying windowed DFT to overlapping segments',
    explanation: 'STFT: X(τ,ω) = Σ x[n]·w[n−τ]·e^(−jωn). Window w slides along signal, DFT at each position.\nSpectrogram: |X(τ,ω)|² visualizes time-frequency energy distribution.\nTime-frequency resolution tradeoff (uncertainty principle): Δt·Δf ≥ 1/(4π). Wider window → better frequency resolution, worse time resolution.\nHop size (stride): overlap between windows. 50–75% overlap typical. Fully overlapping: consecutive phase continuity.\nReconstructing signal: Griffin-Lim algorithm or phase vocoder from spectrogram magnitude.\nApplications: speech recognition, music analysis, voice activity detection, audio watermarking, radar Doppler processing.',
  },
  continuous_wavelet: {
    summary: 'CWT decomposes signal using scaled and shifted mother wavelet, providing multiresolution time-frequency analysis',
    explanation: 'CWT: W(a,b) = (1/√a)·∫x(t)·ψ*((t−b)/a)dt. Scale a controls frequency, shift b controls time.\nMother wavelet ψ(t): must be zero-mean, finite energy (admissibility condition): ∫|Ψ(ω)|²/|ω|dω < ∞.\nCommon wavelets: Morlet (Gaussian-modulated sinusoid, complex), Mexican hat (2nd derivative of Gaussian), Daubechies (orthogonal, compact support).\nMultiresolution: large a (low freq) → wide wavelet, coarse time. Small a (high freq) → narrow wavelet, fine time.\nAdvantage over STFT: adaptive window size — short for high-freq transients, long for low-freq content.\nApplications: ECG analysis, seismic signal processing, image compression (JPEG 2000 uses DWT), denoising.',
  },
  discrete_wavelet: {
    summary: 'DWT decomposes signal through filter bank (low-pass/high-pass pairs) into approximation and detail coefficients',
    explanation: 'DWT: discrete scales/shifts from CWT. Mallat algorithm: iterative low-pass (LP) and high-pass (HP) filtering + downsampling.\nLP → approximation coefficients cA (low-freq). HP → detail coefficients cD (high-freq). Apply again to cA → next level.\nFilter bank: analysis filters h[n] (LP) and g[n] (HP) satisfy perfect reconstruction conditions.\nOrthogonal wavelets (Daubechies): compact support, exact reconstruction. Biorthogonal: linear phase, used in JPEG 2000.\nSparse representation: natural signals (images, ECG) sparse in wavelet domain → efficient compression, denoising (threshold small detail coeffs).\nApplications: image compression (JPEG 2000), ECG denoising, EEG feature extraction, fingerprint compression (FBI WSQ standard).',
  },
  hilbert_transform: {
    summary: 'Hilbert transform produces 90° phase-shifted version of signal; used to construct analytic signal and compute instantaneous attributes',
    explanation: 'Hilbert transform: x̂(t) = (1/π)·P.V.∫x(τ)/(t−τ)dτ. Frequency domain: X̂(ω) = −j·sgn(ω)·X(ω).\nAnalytic signal: z(t) = x(t) + j·x̂(t). No negative frequency content.\nInstantaneous amplitude (envelope): A(t) = |z(t)| = √(x² + x̂²).\nInstantaneous phase: φ(t) = arctan(x̂/x). Instantaneous frequency: fi(t) = (1/2π)·dφ/dt.\nDiscrete Hilbert: FIR approximation with Type III linear phase (odd length, antisymmetric). Or via FFT: zero negative freqs, double positive.\nApplications: AM demodulation (envelope detection), EMD (Empirical Mode Decomposition), vibration analysis, speech processing.',
  },
  iq_representation: {
    summary: 'I/Q (in-phase/quadrature) baseband representation separates real and imaginary parts of bandpass signal for efficient processing',
    explanation: 'Bandpass signal: x(t) = xI(t)cos(2πfct) − xQ(t)sin(2πfct). I and Q are baseband equivalents.\nComplex baseband: x̃(t) = xI(t) + j·xQ(t). Spectrum centered at 0 instead of ±fc → lower sample rate needed.\nDownconversion: multiply by cos(2πfct) and sin(2πfct) → low-pass filter → I and Q channels. Direct conversion (zero-IF) common in SDR.\nI/Q imbalance: amplitude/phase mismatch between I and Q creates image spur. Calibration required.\nModulation: BPSK (Q=0), QPSK (4 constellation points), QAM (N×N grid). Constellation diagram shows I vs Q.\nSoftware Defined Radio (SDR): ADC samples IF, digital downconversion produces I/Q. RTL-SDR, HackRF, USRP use this.',
  },
  ofdm_system: {
    summary: 'OFDM multiplexes data over many orthogonal subcarriers using IFFT/FFT, achieving robustness to multipath fading',
    explanation: 'OFDM: N subcarriers at frequencies fc+k·Δf. Orthogonality: Δf = 1/Ts (subcarrier spacing = 1/symbol duration).\nTransmitter: serial data → IFFT → add cyclic prefix (CP) → DAC → RF. Receiver: ADC → remove CP → FFT → equalize.\nCyclic prefix: copy last Ncp samples to front. Converts linear convolution to circular → simple frequency-domain equalization.\nCP must be longer than channel delay spread. CP overhead: Ncp/(N+Ncp). Typical: 25% overhead.\nChannel equalization: single-tap per subcarrier Y[k] = H[k]·X[k] + N[k]. H[k] estimated via pilot subcarriers.\nPeak-to-Average Power Ratio (PAPR): high (up to 12 dB for OFDM). Problem for PA efficiency. Mitigation: clipping, SLM, PTS.\nStandards: LTE/5G (OFDM downlink), WiFi 802.11a/g/n/ac/ax, DVB-T, DAB.',
  },
  adaptive_filter_lms: {
    summary: 'LMS adaptive filter updates weights by steepest descent on instantaneous squared error, trading convergence speed for simplicity',
    explanation: 'LMS algorithm: w[n+1] = w[n] + μ·e[n]·x[n]. e[n] = d[n] − w^T[n]·x[n] (error signal).\nStep size μ: too large → unstable, too small → slow convergence. Stability: 0 < μ < 2/λmax.\nConvergence rate: depends on eigenvalue spread of input correlation matrix R = E[x·x^T]. Misadjustment M = μ·tr(R)/2.\nNLMS (normalized): μn = μ/(x^T[n]x[n] + ε). Normalized by signal power → less sensitive to input power variations.\nApplications: echo cancellation (telephone, acoustic), noise cancellation (headphones), channel equalization, antenna beamforming, system identification.\nComputational cost: O(N) per sample (N = filter order). Much simpler than RLS (O(N²)) but slower convergence.',
  },
  adaptive_filter_rls: {
    summary: 'RLS minimizes weighted sum of past squared errors using matrix inversion lemma for exact optimal filter at each step',
    explanation: 'RLS: minimizes Σλ^(n−k)|e[k]|². Forgetting factor λ ∈ (0,1] weights recent data more.\nRecursive update: P[n] = (1/λ)(P[n−1] − k[n]·x^T[n]·P[n−1]) where k[n] = P[n−1]x[n]/(λ + x^T[n]P[n−1]x[n]).\nw[n] = w[n−1] + k[n]·e*(n). P[n] ≈ R^{−1}[n] (inverse correlation matrix).\nConvergence: exponential convergence in ~N iterations regardless of eigenvalue spread. Superior to LMS.\nComputational cost: O(N²) per sample. QR-RLS variant more numerically stable.\nApplications: fast-converging echo cancellation, rapid channel tracking, spectral estimation. Preferred when fast adaptation needed.',
  },
  matched_filter_signal: {
    summary: 'Matched filter maximizes SNR by correlating received signal with known transmitted pulse shape; optimal detector for AWGN',
    explanation: 'Matched filter h(t) = s*(T−t): time-reversed conjugate of transmitted signal s(t). Output at t=T: peak SNR = 2E/N0.\nProof (Cauchy-Schwarz): |∫y(t)h(t)dt|² ≤ ∫|y|²·∫|h|² with equality when h ∝ y. Maximizes SNR.\nFrequency domain: H(f) = S*(f)·e^(−j2πfT). Multiply received spectrum by conjugate of signal spectrum.\nPulse compression (radar): transmit chirp (linear FM sweep), receive + matched filter → compressed pulse. Time-bandwidth product B·T → pulse compression gain.\nOptimal detector (AWGN): maximize log-likelihood ratio → correlate with each possible signal. For binary: compare r·s1 vs r·s2.\nBit error probability: Pb = Q(√(2Eb/N0)) for BPSK. Q-function: Q(x) = P(N > x) for N∼N(0,1).',
  },
  music_algorithm: {
    summary: 'MUSIC exploits noise subspace orthogonality to signal eigenvectors for super-resolution Direction-of-Arrival estimation',
    explanation: 'MUSIC (MUltiple SIgnal Classification): R = E[x·x^H] = A·Ss·A^H + σ²·I. Eigendecompose R.\nSignal subspace: eigenvectors of R corresponding to D largest eigenvalues. Noise subspace: remaining M−D eigenvectors.\nOrthogonality: a(θ) ⊥ noise subspace for true DOAs. MUSIC pseudospectrum: P(θ) = 1/||E_N^H·a(θ)||².\nPeaks of P(θ) correspond to true DOAs. Resolution far superior to conventional beamforming (can resolve closely spaced sources).\nArray manifold a(θ): [1, e^j2πd·sin(θ)/λ, ..., e^j2π(M−1)d·sin(θ)/λ] for ULA. d = element spacing.\nLimitation: requires D < M (fewer sources than elements), uncorrelated sources, known number of signals.',
  },
  mimo_signal_model: {
    summary: 'MIMO system with Nt transmit and Nr receive antennas achieves capacity C = log₂det(I + SNR/Nt·H·H^H) bits/s/Hz',
    explanation: 'MIMO channel: y = H·x + n. H is Nr×Nt complex channel matrix. Entry H_ij = channel from j-th Tx to i-th Rx.\nCapacity (water-filling): C = Σlog₂(1 + μλi/N0) where λi are eigenvalues of H·H^H and μ is water level.\nSpatial multiplexing: transmit independent data streams. Capacity grows linearly with min(Nt,Nr).\nDiversity: send same data on multiple paths → combines → SNR gain. Diversity order = Nt×Nr.\nDiversity-multiplexing tradeoff: d(r) = (Nt−r)(Nr−r). Higher multiplexing gain r → lower diversity order d.\nDetection: ML (optimal, exponential cost), ZF (noise amplification), MMSE, SIC (V-BLAST, successive interference cancellation).\nSVD precoding: H = U·Σ·V^H. Precode with V, combine with U^H → parallel independent sub-channels.',
  },
  polyphase_filter_bank: {
    summary: 'Polyphase decomposition restructures multirate filter bank for computationally efficient interpolation and decimation',
    explanation: 'Polyphase: H(z) = Σ_{k=0}^{M-1} z^{−k}·Ek(z^M). Splits H(z) into M polyphase components Ek(z).\nDecimation by M: compute H(z)·X(z), then downsample by M. Equivalent: apply Ek(z) to downsampled input then combine. Saves M× compute.\nInterpolation by L: upsample first, then filter. Polyphase: apply each Ek(z) in turn to input, shift. L× more efficient.\nAnalysis filter bank: M-channel, each channel decimated by M. Synthesis: upsample and filter each channel, sum.\nPerfect reconstruction condition: synthesis filters are time-reversed modulated analysis filters (QMF conditions).\nApplications: multirate signal processing, OFDM (polyphase network reduces FFT size), transmultiplexer, audio subband coding.',
  },
  compressive_sensing: {
    summary: 'CS recovers sparse signals from far fewer measurements than Nyquist requires by solving l1-minimization or greedy algorithms',
    explanation: 'Compressive sensing: y = Φ·x, where Φ is M×N measurement matrix, M ≪ N. Recover x with s non-zeros from M = O(s·log(N/s)) measurements.\nRestricted Isometry Property (RIP): Φ approximately preserves distances between sparse vectors. Gaussian/Bernoulli random matrices satisfy RIP with high probability.\nRecovery: Basis Pursuit: min ||x||₁ s.t. y = Φ·x. Equivalent to minimum l0 for sparse signals under RIP.\nGreedy algorithms: OMP (Orthogonal Matching Pursuit), CoSaMP. Iteratively select atoms most correlated with residual.\nSparsifying basis: signals sparse in DCT (images), wavelet (natural signals), Fourier (tones), or learned dictionaries.\nApplications: MRI acquisition (10× speedup), single-pixel camera, compressed radar, spectrum sensing in cognitive radio.',
  },
  power_spectral_density: {
    summary: 'PSD describes power distribution vs frequency; estimated via periodogram, Welch, or parametric AR methods',
    explanation: 'PSD: Sxx(f) = lim_{T→∞} E[|X_T(f)|²]/T where X_T = FT of windowed x(t). Units: V²/Hz or dBm/Hz.\nWiener-Khinchin: Sxx(f) = FT{Rxx(τ)} where Rxx(τ) = E[x(t)x*(t−τ)] is autocorrelation.\nPeriodogram: |X(f)|²/N. Inconsistent estimator (variance doesn\'t decrease with N). Bartlett: average non-overlapping segments.\nWelch method: average overlapping windowed periodograms. 50% overlap + Hann window → good variance/resolution tradeoff.\nAR (parametric) estimation: fit AR model, compute PSD from model coefficients. High resolution but model-order sensitive.\nCoherence: γxy(f) = |Sxy(f)|²/(Sxx(f)·Syy(f)) ∈ [0,1]. Measures linear dependency between signals at each frequency.',
  },
  multirate_processing: {
    summary: 'Multirate DSP changes sample rate via integer decimation (downsample) or interpolation (upsample) with anti-aliasing filters',
    explanation: 'Decimation by M: low-pass filter (fc = π/M) then downsample by M (keep every M-th sample). Prevents aliasing.\nInterpolation by L: upsample by L (insert L−1 zeros), then low-pass filter (fc = π/L) × L. Removes imaging.\nRational rate conversion P/Q: upsample by P, filter at fc = π/max(P,Q), downsample by Q. Single filter does both.\nCascaded integrator-comb (CIC): hardware-efficient decimation/interpolation filter. No multipliers — only add/subtract/accumulate.\nFarrow filter: fractional delay implementation using polynomial interpolation. Used in asynchronous sample-rate conversion.\nApplications: CD (44.1 kHz) → DAT (48 kHz) conversion, software radio (multi-standard), oversampled ADC, digital audio.',
  },
  raised_cosine_filter: {
    summary: 'Raised cosine pulse shaping achieves zero ISI at Nyquist rate sampling points while controlling bandwidth via roll-off factor α',
    explanation: 'Raised cosine: H(f) = 1 for |f| ≤ (1−α)/2T; cosine rolloff for (1−α)/2T < |f| < (1+α)/2T; 0 otherwise.\nTime domain: h(t) = sinc(t/T)·cos(παt/T)/(1−(2αt/T)²). Zero crossings at t = ±T, ±2T, ... (ISI-free Nyquist condition).\nRoll-off α ∈ [0,1]: α=0 → brick-wall (ideal, sinc pulse). α=1 → maximum bandwidth, smoothest pulse.\nBandwidth: B = (1+α)/(2T). For α=0: B = 1/2T (minimum Nyquist bandwidth). α=0.5: B = 0.75/T.\nRoot raised cosine (RRC): split between transmitter and receiver. Tx: RRC, Rx: RRC → matched filtering → RC overall.\nApplications: virtually all digital communications (QAM, BPSK). α=0.22 (LTE), α=0.35 (IS-95), α=0.5 (DVB-S).',
  },
  random_process_wss: {
    summary: 'Wide-sense stationary process has constant mean and autocorrelation depending only on lag τ, enabling spectral analysis',
    explanation: 'WSS conditions: E[x(t)] = μ (constant), Rxx(t1,t2) = Rxx(τ) where τ = t1−t2 (depends on lag only).\nStrictly stationary: all joint distributions time-invariant. WSS weaker. Gaussian WSS → strictly stationary.\nPower spectral density: Sxx(f) = FT{Rxx(τ)} (Wiener-Khinchin). PSD must be real, non-negative, even symmetric.\nLTI system with WSS input: Syy(f) = |H(f)|²·Sxx(f). Output mean: μy = H(0)·μx. Output is also WSS.\nErgodic process: time averages equal ensemble averages. WSS + ergodic → PSD estimable from single long realization.\nWhite noise: Rxx(τ) = σ²·δ(τ), Sxx(f) = σ² (flat PSD). Bandwidth-limited (physical) white noise: bandlimited PSD.',
  },
  group_delay: {
    summary: 'Group delay τg(ω) = −dφ(ω)/dω measures frequency-dependent propagation delay; flat group delay → no dispersion',
    explanation: 'Group delay: τg(ω) = −darg{H(jω)}/dω. Constant → linear phase → all frequencies delayed equally → no distortion.\nLinear phase FIR: symmetric coefficients give exactly linear phase. Type I: odd length, symmetric → linear phase at all ω.\nPhase distortion: non-constant τg → different frequency components arrive at different times → waveform distortion.\nAllpass system: |H(jω)| = 1, τg(ω) ≥ 0. Used to equalize group delay of other filters.\nIIR filters: Butterworth has non-constant τg. Bessel/Thomson filter: maximally flat group delay (constant τg for low ω).\nOFDM: CP absorbs multipath delay spread. Within each subcarrier: only magnitude equalization needed (no group delay correction).',
  },
  envelope_detector: {
    summary: 'Envelope detector extracts amplitude modulation by rectifying and low-pass filtering bandpass signal',
    explanation: 'AM signal: x(t) = [Ac + m(t)]·cos(2πfct). Envelope = Ac + m(t) (must be positive if Ac ≥ |m(t)|_max).\nDiode envelope detector: diode charges capacitor C to peak, RC discharges slowly between peaks. RC must satisfy: 1/fc ≪ RC ≪ 1/B where B = modulation bandwidth.\nOver-modulation (index > 1): envelope goes negative → detector fails → nonlinear distortion.\nSquare-law detector: (·)² then LPF. Output ∝ envelope². Better for very weak signals (near noise floor). Used in envelope followers for AM carrier power measurement.\nDigital implementation: compute I/Q components → magnitude √(I²+Q²) → smooth with LPF.\nApplications: AM radio demodulation, Doppler radar, vibration monitoring, communication signal strength measurement.',
  },

  // ── CONTROL SYSTEMS (extended) ─────────────────────────────────
  bode_plot: {
    summary: 'Bode plot shows magnitude (dB) and phase (degrees) of loop transfer function vs log frequency; used to read stability margins',
    explanation: 'Magnitude: |H(jω)|_dB = 20·log10|H(jω)|. Phase: ∠H(jω). Asymptotic approximations: pole at ω=ωp → −20 dB/dec, −90° step.\nPoles/zeros contribution: each pole −20 dB/dec slope change, each zero +20 dB/dec. Initial slope = 20·(#zeros−#poles at origin).\nGain crossover frequency ωgc: |L(jωgc)| = 1 (0 dB). Phase margin PM = 180° + ∠L(jωgc). PM > 30° → stable.\nPhase crossover frequency ωpc: ∠L(jωpc) = −180°. Gain margin GM = 1/|L(jωpc)|_dB. GM > 6 dB → stable.\nNon-minimum phase: RHP zeros cause phase to drop below what poles alone predict → limits achievable PM.\nDesign: add lead compensator to increase PM at ωgc; add lag compensator to increase low-freq gain without hurting PM.',
  },
  nyquist_criterion: {
    summary: 'Nyquist stability criterion relates open-loop frequency response encirclements of −1 point to closed-loop stability',
    explanation: 'Nyquist theorem: closed-loop poles P in RHP = N + Z_OL where N = clockwise encirclements of (−1,0), Z_OL = RHP zeros, P_OL = RHP poles.\nFor stable open-loop (P_OL=0): closed-loop stable iff Nyquist plot doesn\'t encircle −1.\nNyquist plot: L(jω) for ω from −∞ to +∞. Usually plot ω: 0→∞ and use symmetry.\nAdvantage over Bode: handles time delays (OLHP zeros), RHP poles, non-minimum-phase plants correctly.\nConditionally stable system: stable only within a gain range (multiple −1 crossings).\nRobust stability: minimum distance from Nyquist plot to −1 = 1/(1+PM_margin). Relates to H∞ norm of sensitivity.',
  },
  routh_hurwitz: {
    summary: 'Routh-Hurwitz criterion determines number of RHP roots of polynomial without solving it, using array of coefficient signs',
    explanation: 'Routh array: from polynomial a_n·s^n + ... + a_0. Fill rows using cross-multiplication formula.\nSign changes in first column = number of RHP roots. All positive → all roots in LHP.\nSpecial case 1: zero in first column but nonzero row → replace with ε → 0+, continue, count sign changes.\nSpecial case 2: entire row zero → auxiliary polynomial (pair of symmetric roots). Differentiate auxiliary poly → fill next row.\nCritical gain: find K where first-column element = 0 → marginal stability (oscillation frequency from auxiliary poly).\nLimitation: polynomial coefficients only. For frequency-domain, use Nyquist. For delay systems, use Padé approx first.',
  },
  root_locus_method: {
    summary: 'Root locus shows how closed-loop poles migrate in s-plane as gain K varies from 0 to ∞',
    explanation: 'Root locus: closed-loop poles satisfy 1 + K·L(s) = 0 → L(s) = −1/K. Angle condition: ∠L(s) = ±180°(2k+1).\nRules: starts at OL poles (K=0), ends at OL zeros (K→∞) or asymptotes. N−M asymptotes for N poles, M zeros.\nAsymptote angles: (2k+1)·180°/(N−M). Centroid σ = (Σpoles − Σzeros)/(N−M).\nBreakaway point: dK/ds = 0. Imaginary axis crossing: Routh with K as parameter, or set s=jω.\nPD controller: adds zero to root locus → bends branches toward LHP → improve damping.\nPI controller: adds pole at origin (integrator) + zero → forces zero steady-state error, must ensure stability.',
  },
  lead_compensator: {
    summary: 'Lead compensator C(s) = K(s+z)/(s+p), z<p, adds phase lead at crossover to increase phase margin and bandwidth',
    explanation: 'Lead: zero at z, pole at p, z < p. Phase: φ(ω) = arctan(ω/z) − arctan(ω/p) > 0. Max phase at ωm = √(z·p).\nMax phase lead: φmax = arcsin((1−α)/(1+α)) where α = z/p. For α=0.1: φmax ≈ 55°.\nDesign steps: 1. Find required PM. 2. Select φmax = required PM − current PM + margin. 3. Place ωm at new ωgc. 4. Compute z, p.\nEffect: increases bandwidth (ωgc increases), improves transient response, reduces rise time. Slight noise amplification (high-freq gain = K·p/z).\nBode view: +20 dB/dec from z to p → magnitude bump shifts ωgc right. Phase bump increases PM.\nMultiple lead stages: each adds up to ~55° phase. Stack two leads for > 55° needed correction.',
  },
  lag_compensator: {
    summary: 'Lag compensator adds attenuation at high frequency to increase low-frequency gain and reduce steady-state error without losing PM',
    explanation: 'Lag: C(s) = K(s+z)/(s+p), p < z (pole closer to origin than zero). High-freq gain = K·p/z < K.\nLow-frequency (DC) gain: K·z/p > K → better steady-state accuracy (higher Kp, Kv, Ka).\nDesign: place lag so −20 dB/dec attenuation takes effect well below ωgc (typically z = ωgc/10). Phase lag at ωgc ≈ −5° to −10°.\nEffect: reduces bandwidth (ωgc decreases slightly), slower transient response, better steady-state. Less noise sensitive than lead.\nPID as lead-lag: PD ≈ lead, PI ≈ lag. Complete PID provides both steady-state and transient improvements.\nLag-lead: combine both → high DC gain + adequate PM + reasonable bandwidth. Common in precision servo systems.',
  },
  pid_tuning_zn: {
    summary: 'Ziegler-Nichols tuning sets PID gains empirically from open-loop step response (S-curve) or closed-loop oscillation test',
    explanation: 'ZN open-loop (process reaction method): apply step → S-shaped response. Measure dead time L and slope R = K/τ.\nKp = 1.2/(R·L), Ti = 2L, Td = 0.5L for PID (aggressive, ~25% overshoot).\nZN closed-loop (ultimate gain method): increase Kp until sustained oscillation → ultimate gain Ku, period Tu.\nPID: Kp = 0.6Ku, Ti = Tu/2, Td = Tu/8. Quarter-decay ratio response.\nSIMC (Skogestad): more conservative, better robustness. τc = max(L, τ/10). Kp = (τ+L/2)/(R·(τc+L)).\nModern alternatives: relay auto-tune (identifies Ku automatically), model-based IMC, AMIGO, Lambda tuning for integrating processes.',
  },
  pid_anti_windup: {
    summary: 'Anti-windup prevents integrator accumulation during actuator saturation, reducing overshooting when saturation ends',
    explanation: 'Integrator windup: when actuator saturates, error continues to integrate → large accumulated integral → overshoot on exit from saturation.\nBack-calculation anti-windup: subtract tracking error u − u_sat from integrator input with gain 1/Tt. Tt ≈ √(Ti·Td).\nConditional integration: stop integrating when |u| > umax and error has same sign as integrator. Simple but discontinuous.\nClamping: stop integrating when |u| > umax (regardless of error sign). Simple implementation.\nOutput saturation range: ±umax. Design for specified saturation frequency. Large signals much more constrained.\nDiscrete implementation: backward-difference integration with anti-windup clamping each sample step. Matches continuous closely.',
  },
  state_feedback: {
    summary: 'Full-state feedback u = −Kx places closed-loop poles anywhere (if system controllable) via gain matrix K',
    explanation: 'State space: ẋ = Ax + Bu, y = Cx + Du. Control: u = −Kx (full-state feedback assumes all states measurable).\nClosed-loop: ẋ = (A−BK)x. Poles = eigenvalues of A−BK. Arbitrarily placeable if (A,B) controllable.\nControllability matrix: Mc = [B AB A²B ... A^{n−1}B]. Controllable iff rank(Mc) = n.\nAckermann\'s formula: K = e_n^T · Mc^{−1} · φ(A) where φ(s) = desired characteristic polynomial.\nLinear Quadratic Regulator (LQR): minimize J = ∫(x^TQx + u^TRu)dt → K = R^{−1}B^TP where P solves Riccati: A^TP + PA − PBR^{−1}B^TP + Q = 0.\nIntegral action: augment state with integrator for reference tracking. Or use two-DOF structure.',
  },
  luenberger_observer: {
    summary: 'Full-order observer estimates states from inputs and outputs; error dynamics A−LC placed in LHP via gain L',
    explanation: 'Observer: x̂̇ = A·x̂ + B·u + L(y − C·x̂). Error e = x − x̂: ė = (A−LC)·e.\nObservability: (A,C) observable iff Wo = [C^T A^TC^T ... (A^{n−1})^TC^T]^T has rank n.\nL chosen so eigenvalues of A−LC in LHP (stable), faster than closed-loop poles (2–5× separation rule).\nSeparation principle: controller gain K and observer gain L can be designed independently. Combined stable if both subsystems stable.\nReduced-order observer: (n−p)-dimensional observer exploits known outputs. Lower order, faster, more sensitive to noise.\nKalman filter: optimal observer for stochastic systems. Minimizes trace(P) where P = E[e·e^T]. Updates L based on process/measurement noise covariance.',
  },
  lqr_control: {
    summary: 'LQR minimizes quadratic cost J = ∫(x^TQx + u^TRu)dt via Riccati equation, balancing state deviation against control effort',
    explanation: 'LQR: optimal state feedback gain K* = R^{−1}B^TP. P satisfies algebraic Riccati equation: A^TP + PA − PBR^{−1}B^TP + Q = 0.\nQ ≥ 0: penalizes state deviation. R > 0: penalizes control effort. Increase Q_{ii}/R → tighter control of state i.\nFrequency-domain: LQR guarantees ≥ 60° PM and ≥ 6 dB GM for single-input systems. Inherent robustness.\nInfinite horizon: time-invariant K. Finite horizon (time-varying): K(t) from Riccati ODE, used in trajectory tracking.\nLoop transfer recovery (LTR): combine LQG with Kalman filter → recover LQR robustness properties.\nTracking extension: augment with integral state for zero steady-state tracking error. Preview control for known reference.',
  },
  mpc_control: {
    summary: 'MPC solves finite-horizon optimization online at each step using a model, applying only the first control action',
    explanation: 'MPC: at each step k, minimize J = Σ||y(k+i|k)−r||²Q + ||Δu||²R subject to constraints u∈U, y∈Y over horizon N.\nReceding horizon: apply u*(k|k), shift horizon, re-optimize at k+1. Feedback closed-loop despite open-loop optimization.\nKey advantage: handles input/output constraints explicitly (actuator limits, state bounds). LQR/LQG cannot.\nLinear MPC: QP (quadratic programming) solved each sample. OSQP, ECOS, active-set solvers. Typical: 1–100 ms solve time.\nNonlinear MPC (NMPC): NLP solved each step (Ipopt, ACADO). Computationally intensive → embedded horizon ≤ 10 steps.\nApplications: process control (chemical plants), autonomous vehicles (MPC trajectory tracking), spacecraft attitude, power grid frequency control.',
  },
  sliding_mode_control: {
    summary: 'SMC drives system to sliding surface s(x)=0 and constrains it there using discontinuous control; robust to matched uncertainties',
    explanation: 'Sliding surface: s(x) = 0 defines desired dynamics (e.g., s = ė + λe for tracking). Dimension reduced by 1.\nControl law: u = ueq + un. Equivalent control: ueq maintains s=0 for nominal system. Discontinuous: un = −η·sgn(s).\nReaching condition: V̇ = s·ṡ < −η|s| (Lyapunov). Forces s → 0 in finite time.\nRobustness: once on sliding surface, dynamics depend only on reduced-order sliding manifold. Invariant to matched uncertainties.\nChattering: discontinuous sgn causes high-frequency oscillation. Remedy: boundary layer u = −η·sat(s/φ). Trades robustness for smoothness.\nHigh-order sliding mode (HOSM): drives s = ṡ = ... = s^(r−1) = 0. Twisting, super-twisting algorithms. Reduces chattering.',
  },
  lyapunov_stability: {
    summary: 'Lyapunov stability proves equilibrium stability by finding positive definite energy-like function V whose derivative is negative definite',
    explanation: 'Lyapunov direct method: find V(x) > 0 (positive definite) with V̇(x) < 0 along trajectories → equilibrium x=0 is asymptotically stable.\nLyapunov theorem: V(0)=0, V(x)>0 for x≠0, V̇(x) ≤ 0 (stable). V̇ < 0 → asymptotically stable. V̇ ≤ 0 + LaSalle → can prove asymptotic stability.\nLinear systems: V = x^TPx. V̇ = x^T(A^TP+PA)x < 0 iff A^TP+PA = −Q < 0 (Lyapunov equation). Stable iff solution P > 0 exists.\nGlobal asymptotic stability: requires additionally V(x) → ∞ as ||x|| → ∞ (radially unbounded).\nLaSalle\'s invariance principle: largest invariant set within {x: V̇=0} → asymptotic stability even if V̇ not strictly negative.\nBarrier functions: V(x) → ∞ near boundary → control barrier function (CBF) for safety-critical control.',
  },
  controllability: {
    summary: 'A system is controllable if any state can be driven to any other state in finite time using unconstrained inputs',
    explanation: 'Controllability matrix: Mc = [B | AB | A²B | ... | A^{n-1}B]. System controllable iff rank(Mc) = n.\nPBH test: (A,B) controllable iff for all λ, [A−λI | B] has rank n. Equivalent to no left eigenvector orthogonal to B.\nUnreachable modes: modes not appearing in Mc are uncontrollable — cannot be influenced by u.\nMinimum energy control: for controllable system, u*(t) = B^T·e^{A^T(T-t)}·W_c^{-1}(T)·(x_f − e^{AT}x_0).\nControllability Gramian: W_c(T) = ∫e^{At}BB^Te^{A^Tt}dt from 0 to T. Condition number of W_c: directions harder to control.\nStabilizability: weaker — only unstable modes need be controllable. Stable modes can be uncontrollable.',
  },
  observability: {
    summary: 'A system is observable if initial state can be uniquely determined from output measurements over finite time',
    explanation: 'Observability matrix: Wo = [C; CA; CA²; ...; CA^{n-1}]. Observable iff rank(Wo) = n.\nPBH test: (C,A) observable iff [A−λI; C] has rank n for all λ.\nUnobservable modes: modes not in Wo → hidden from output, cannot be estimated.\nObservability Gramian: W_o(T) = ∫e^{A^Tt}C^TCe^{At}dt. Poorly conditioned → some modes hard to observe.\nDuality: (A,B) controllable ↔ (A^T,B^T) observable. Exploit duality in design (control/estimation equivalent problems).\nDetectability: weaker — only unstable unobservable modes prevent estimation. Stable unobservable modes decay naturally.',
  },
  digital_pid: {
    summary: 'Discrete-time PID implementation uses backward Euler or Tustin integration and derivative filtering for digital control systems',
    explanation: 'Continuous PID: C(s) = Kp(1 + 1/Ti·s + Td·s). Discretize for sampling period T.\nBackward Euler: s → (z−1)/(T·z). Integral: ui[k] = ui[k−1] + (Kp/Ti)·T·e[k].\nTustin (bilinear): s → 2(z−1)/(T(z+1)). Better frequency-domain matching. Pre-warp at crossover frequency.\nDerivative filter: D(s) = Kp·Td·s/(1+Td·s/N). Limits high-freq gain. N typically 5–20.\nDiscrete derivative: ud[k] = Kp·Td/T·(e[k]−e[k−1]) or with Tustin. Difference amplifies quantization noise.\nImplementation checklist: anti-windup clamp, bumpless parameter change (reset internal states), output limiting, integrator initialization.',
  },
  gain_scheduling: {
    summary: 'Gain scheduling varies controller parameters as a function of measurable operating conditions to handle nonlinear plant behavior',
    explanation: 'Gain scheduling: controller C(θ) parameterized by scheduling variable θ (speed, temperature, altitude, etc.).\nDesign: linearize plant at multiple operating points (θ1, θ2, ...), design linear controllers at each, interpolate gains.\nInterpolation: linear table lookup, polynomial fit, or fuzzy blending of neighboring controllers.\nKey concern: stability during scheduling transitions (rapid θ change). Frozen-parameter analysis insufficient — need transition stability analysis.\nLPV (Linear Parameter-Varying): plant A(θ), B(θ), C(θ). LPV synthesis via LMI gives stability guarantee during scheduling.\nApplications: aircraft flight control (Mach, altitude), automotive engine control (throttle, RPM), wind turbine (wind speed), HVAC (load, outdoor temp).',
  },
  mrac_adaptive: {
    summary: 'Model Reference Adaptive Control adjusts plant parameters to make closed-loop match a reference model using MIT rule or Lyapunov',
    explanation: 'MRAC: reference model Wm(s) specifies desired closed-loop behavior. Plant parameters θ adjusted to minimize output error e = y − ym.\nMIT rule: dθ/dt = −γ·e·∂e/∂θ. Gradient descent on instantaneous squared error. May be unstable without modification.\nLyapunov MRAC: design adaptation law from Lyapunov function. Guarantees stability and error convergence under persistent excitation.\nPersistent excitation (PE): reference input r(t) must be persistently exciting — contains sufficient frequency content for parameter convergence.\nDead zone: stop adapting when |e| < δ (noise level). Prevents parameter drift due to noise.\nApplications: aerospace (adaptive flight control, F-16 MRAC), robot manipulators, electric drives with uncertain parameters.',
  },
  h_infinity_control: {
    summary: 'H∞ control minimizes worst-case disturbance-to-output gain ||Tzw||∞ providing robust stability and performance guarantees',
    explanation: 'H∞ norm: ||G||∞ = sup_ω σmax(G(jω)) — maximum singular value over all frequencies.\nH∞ problem: find controller K minimizing ||Fl(P,K)||∞ < γ where P is generalized plant, Fl is lower LFT.\nMixed sensitivity: minimize ||[W1·S; W2·KS; W3·T]||∞. W1 shapes sensitivity S, W3 shapes complementary T.\nRiccati solution: two coupled Riccati equations for H∞ state-feedback + filter. Spectral factorization approach.\nLMI formulation: H∞ condition equivalent to LMI feasibility — convex, solved by semidefinite programming.\nRobust stability: ||ΔK||∞ < 1/||M||∞ where M is nominal loop. Small gain theorem guarantees robust stability.',
  },
  frequency_domain_id: {
    summary: 'Frequency domain system identification estimates transfer function from measured input-output spectra or FRF data',
    explanation: 'Frequency Response Function (FRF): H(f) = Syh(f)/Suu(f) or H(f) = Suy(f)/Suu(f). Estimate from ETFE (empirical TF).\nCoherence γ²(f): measures linear fit quality. γ² ≈ 1 → good SNR, linear. Low coherence → noise, nonlinearity, leakage.\nSubspace methods (N4SID): use MIMO input-output data, subspace projections → state-space matrices A,B,C,D directly.\nARX, ARMAX, OE: polynomial model structures. ARX: FIR from input + feedback from output. Least-squares solution.\nModel validation: compare one-step-ahead prediction vs free simulation. Cross-validation on new dataset. Residual whiteness test.\nClosed-loop ID: direct method (biased for ARX), indirect (use reference), joint IO (unbiased). Required for operational modal analysis.',
  },
  model_predictive_control_constraint: {
    summary: 'Constraint handling in MPC: hard constraints on inputs/outputs enforced via QP; soft constraints via slack variables and penalty',
    explanation: 'Hard input constraints: umin ≤ u ≤ umax. Rate constraints: Δumin ≤ Δu ≤ Δumax. Encoded directly in QP inequality constraints.\nHard output constraints: may be infeasible (during disturbances or prediction errors) → infeasible QP → need softening.\nSoft constraints: add slack variable ε. Constraint y ≤ ymax + ε. Add ρ·ε² to cost. ρ large → nearly hard, ρ small → soft.\nFeasibility recovery: warm start from previous solution + slack. Constraint satisfaction priority ordering.\nOffset-free MPC: disturbance model + augmented observer corrects for steady-state offset. Essential for regulatory control.\nEconomic MPC: optimize economic objective (profit, energy) instead of tracking. Stage cost L(x,u) = −profit. May not be quadratic.',
  },

  // ── MACHINE LEARNING (extended) ────────────────────────────────
  perceptron_model: {
    summary: 'Single-layer perceptron: linear classifier updating weights by Δw = η·(y−ŷ)·x; converges if data linearly separable',
    explanation: 'Perceptron: output ŷ = sign(w^Tx + b). Update: w ← w + η·(y−ŷ)·x when misclassified. η = learning rate.\nConvergence theorem: if data linearly separable, perceptron converges in finite steps. Bound: R²/γ² where R = max||x||, γ = margin.\nLimitation: cannot solve XOR. Minsky & Papert (1969) showed single-layer limitations → AI winter.\nMultilayer perceptron (MLP): multiple layers with nonlinear activations solve non-linear decision boundaries.\nHardlimit activation: step function. Sigmoid σ(x) = 1/(1+e^{-x}). ReLU max(0,x).\nHistorical importance: Rosenblatt (1958), first learning algorithm for neural networks. Basis of modern deep learning.',
  },
  universal_approximation: {
    summary: 'Universal approximation theorem: single hidden layer MLP with enough neurons approximates any continuous function on compact domain',
    explanation: 'Cybenko (1989): any continuous f: R^n → R can be approximated to ε by Σ αi·σ(wi^Tx + bi) with sufficient hidden neurons.\nHornik (1991): applies to general squashing activation functions (not just sigmoid). Width theorem.\nDepth-width tradeoff: deep networks (multiple layers) can approximate functions with exponentially fewer parameters than shallow. Depth is more efficient.\nExpressive power: depth-L ReLU network can represent piecewise linear functions with O(N^L) regions using O(N·L) parameters. Shallow needs O(N^{N·L}) neurons.\nPractical implication: guarantees existence but not learnability. Finding right weights via SGD requires additional assumptions.\nUniversal approximation ≠ universal generalization. Overfitting still occurs without regularization.',
  },
  backprop_algorithm: {
    summary: 'Backpropagation efficiently computes gradients of loss w.r.t. all parameters via chain rule applied backward through computation graph',
    explanation: 'Forward pass: compute activations h_l = σ(W_l·h_{l-1} + b_l) for l=1..L. Record intermediate values.\nBackward pass: compute δ_L = ∂L/∂z_L, then δ_l = (W_{l+1}^T·δ_{l+1}) ⊙ σ\'(z_l) for l = L-1..1.\nGradients: ∂L/∂W_l = δ_l·h_{l-1}^T, ∂L/∂b_l = δ_l. Single backward pass computes all gradients.\nComputation graph: Autograd (PyTorch, JAX) builds dynamic graph. Each operation records backward function. Reverse-mode AD.\nMemory: must store all forward activations for backward. Gradient checkpointing trades memory for recomputation.\nNumerical gradient check: ∂L/∂θ ≈ (L(θ+ε)−L(θ−ε))/(2ε). Verify analytical gradient correctness during debugging.',
  },
  batch_norm: {
    summary: 'Batch normalization normalizes layer inputs across batch dimension, then scales and shifts with learned γ, β parameters',
    explanation: 'BN: ẑ = (z − μ_B)/√(σ_B² + ε), then y = γ·ẑ + β. μ_B, σ_B: batch statistics. γ, β: learned.\nForward pass (train): compute per-feature batch mean/var. Inference: use running mean/var (exponential moving average).\nEffect: smooths loss landscape, reduces sensitivity to weight initialization, acts as regularizer (slight noise per mini-batch).\nAllows higher learning rates: normalized activations prevent exploding/vanishing. Reduces internal covariate shift.\nLimitation: ineffective for small batch sizes (noise in statistics). Bad for RNNs (different sequence lengths).\nAlternatives: Layer Norm (normalize over feature dim), Group Norm (groups of channels), Instance Norm (spatial, style transfer).',
  },
  dropout_regularization: {
    summary: 'Dropout randomly zeros activations with probability p during training, acting as ensemble of 2^n sub-networks',
    explanation: 'Dropout (Srivastava 2014): each neuron independently deactivated with probability p=0.5 per forward pass during training.\nTest time: use all neurons, scale by (1−p) to match expected activation — or use inverted dropout (scale by 1/(1−p) during training).\nEnsemble interpretation: trains ensemble of 2^n networks sharing weights. Test uses geometric mean prediction.\nRegularization effect: prevents co-adaptation of neurons (no single neuron can rely on specific others). Forces distributed representations.\nDropout rate p: typically 0.5 for FC layers, 0.1–0.2 for conv layers. Higher p → more regularization, slower convergence.\nVariants: Spatial dropout (entire feature map channels), DropBlock (contiguous regions), DropConnect (drop weights not activations).',
  },
  resnet_skip_connection: {
    summary: 'ResNet introduces identity shortcut connections F(x)+x enabling 100+ layer networks by solving vanishing gradient problem',
    explanation: 'Residual block: y = F(x,{Wi}) + x where F is 2–3 conv layers. Gradient through shortcut path = 1 always.\nKey insight: easier to learn F(x) = H(x) − x (residual) than H(x) directly. Near-identity maps are trivial residuals.\nGradient flow: ∂L/∂x_l = ∂L/∂x_L · (1 + Σ ∂F/∂x_l). Identity term prevents gradient from vanishing to zero.\nResNet variants: ResNet-50 uses bottleneck blocks (1×1 conv to reduce channels, 3×3, 1×1 to expand). Pre-activation ResNet moves BN+ReLU before conv.\nDimension mismatch: 1×1 conv with stride for projection shortcut when channel or spatial dims change.\nImpact: enabled training of 50/101/152/1000+ layer networks. State-of-art on ImageNet 2015. Foundation for ViT, EfficientNet, etc.',
  },
  vision_transformer_vit: {
    summary: 'ViT applies transformer encoder directly to sequences of image patches, achieving top accuracy without conv inductive bias',
    explanation: 'ViT (Dosovitskiy 2020): split image into P×P patches → linear embed each → 1D sequence of N tokens. Add [CLS] token + positional embedding.\nEncoder: standard transformer (multi-head self-attention + MLP). Classification: linear head on [CLS] token output.\nPatch embedding: H×W×C image, patch size P → (H/P)(W/P) patches, each flattened to P²C dims, projected to D.\nScaling: ViT-B/16 (base, patch 16), ViT-L/32 (large), ViT-H (huge). Outperforms ResNet at scale with enough data.\nInductive bias: no locality, translation equivariance by design (unlike CNN). Learns spatial structure from data.\nDeiT: data-efficient ViT via distillation from CNN teacher. Swin Transformer: hierarchical, local windows, better efficiency.',
  },
  bert_model: {
    summary: 'BERT pre-trains bidirectional transformer on masked language modeling + next sentence prediction for transfer learning',
    explanation: 'BERT (Devlin 2019): 12 (base) / 24 (large) transformer encoder layers. Pre-trained on 3.3B token corpus.\nMasked Language Model (MLM): 15% of tokens replaced with [MASK], [RAND], or same. Model predicts original. Bidirectional context.\nNext Sentence Prediction (NSP): classify whether sentence B follows sentence A. Helps question answering. (Later debated as unhelpful.)\nFine-tuning: add task head (classification, QA, NER) on top of BERT, fine-tune all weights on labeled data.\nTokenization: WordPiece. Vocabulary 30K. Special tokens: [CLS] (sentence start), [SEP] (separator), [MASK].\nVariants: RoBERTa (no NSP, longer training), ALBERT (parameter sharing, cross-layer sharing), DistilBERT (distilled 60% smaller).',
  },
  gpt_model: {
    summary: 'GPT pre-trains autoregressive transformer decoder on next-token prediction; scales to emergent in-context learning ability',
    explanation: 'GPT architecture: N transformer decoder layers (causal self-attention — cannot attend future). Pre-trained on web text (1.5B–1T+ tokens).\nAutoregressive: P(w1,...,wT) = Π P(wi|w_{<i}). Next-token prediction objective: maximize log-likelihood.\nScaling laws (Chinchilla): loss scales as L = C_0 + A/N^α + B/D^β. Compute-optimal: D ≈ 20·N (data scales with params).\nIn-context learning (ICL): GPT-3 (175B) can learn new tasks from examples in prompt without weight updates. Emergent at scale.\nInstruction tuning: fine-tune on (instruction, response) pairs → ChatGPT-style behavior. RLHF aligns with human preferences.\nGPT-4: multimodal (text + image). Architecture undisclosed. MMLU, HumanEval, bar exam performance near human level.',
  },
  lora_finetune: {
    summary: 'LoRA freezes pretrained weights and injects low-rank matrices ΔW = BA into each layer, enabling parameter-efficient fine-tuning',
    explanation: 'LoRA (Hu 2022): freeze W₀ ∈ R^{d×k}, add ΔW = BA where B ∈ R^{d×r}, A ∈ R^{r×k}, rank r ≪ min(d,k).\nForward: h = W₀x + ΔWx = W₀x + BAx. Only A,B trained. Parameters: 2·r·d instead of d². For r=8, d=4096: 0.1% of params.\nInitialization: A ~ Gaussian, B = 0 (so ΔW=0 at start → stable fine-tuning start).\nAdaptation: typically apply LoRA to attention Q, V matrices. Some apply to all linear layers.\nMerging: at inference, W = W₀ + BA (no latency overhead). Switch adapters by swapping BA matrices.\nQLoRA: 4-bit quantize base model (NF4), LoRA adapters in BF16. Fine-tune 65B model on single 48GB GPU.',
  },
  mixture_of_experts: {
    summary: 'MoE routes each token to top-k expert sub-networks via learned gating, enabling massive model capacity at fixed compute cost',
    explanation: 'MoE layer: N expert FFN networks + router G(x) = softmax(W_g·x). Route to top-k experts (typically k=1 or 2).\nSparse activation: only k/N of parameters active per token → N× more capacity at same FLOPs vs dense model.\nGating: Noisy top-k gating adds Gaussian noise for load balancing. Auxiliary loss encourages uniform expert utilization.\nGShard / Switch Transformer: first large-scale MoE LLMs. Mixtral 8×7B: 8 experts, top-2 routing, 13B active / 47B total params.\nToken routing: load imbalance problem — popular experts overflow capacity (expert capacity C = tokens/k × capacity_factor).\nExpert collapse: without aux loss, all tokens route to few experts → waste. Entropy regularization, expert choice routing.',
  },
  flash_attention: {
    summary: 'FlashAttention tiles attention computation to stay in SRAM, reducing HBM reads/writes from O(N²) to O(N), enabling longer contexts',
    explanation: 'Standard attention: load Q,K,V from HBM → compute S = QK^T/√d (O(N²) storage) → softmax → output. HBM bandwidth bottleneck.\nFlashAttention (Dao 2022): tile Q into blocks, load K,V blocks. Compute partial softmax in SRAM. Running max/denominator for numerically stable online softmax.\nIO complexity: O(N²d/M) HBM reads instead of O(N² + Nd). M = SRAM size. 2–4× wallclock speedup.\nExact computation: no approximation. Same output as naive attention. Fused kernel avoids materializing N×N attention matrix.\nFlashAttention-2: reorder loops, parallelize across sequence. FlashAttention-3: exploits H100 tensor core async + FP8.\nContext extension: enables 8K→128K context training (LLaMA-3, Gemini, Anthropic Claude use FlashAttention family).',
  },
  diffusion_ddpm: {
    summary: 'DDPM adds Gaussian noise over T steps then trains U-Net to reverse process, generating samples by iterative denoising',
    explanation: 'Forward process: q(x_t|x_{t-1}) = N(√(1−β_t)x_{t-1}, β_t·I). After T steps: x_T ≈ N(0,I) (pure noise).\nClosedform: x_t = √ᾱ_t·x_0 + √(1−ᾱ_t)·ε where ᾱ_t = Π(1−β_k). Single-step noising from x_0.\nReverse: p_θ(x_{t-1}|x_t) = N(μ_θ(x_t,t), Σ_θ). Train neural net to predict noise ε_θ(x_t,t).\nLoss: L = E||ε − ε_θ(x_t, t)||². Simple regression on noise prediction. Equivalent to weighted ELBO.\nSampling: DDPM = T=1000 steps. DDIM: deterministic, 50 steps. Consistency models: 1–4 steps.\nApplications: Stable Diffusion (latent diffusion, CLIP text conditioning), DALL-E 3, Sora (video), AudioLDM.',
  },
  graph_neural_network: {
    summary: 'GNN updates node representations by aggregating messages from neighbors, enabling learning on non-Euclidean graph-structured data',
    explanation: 'Message passing: h_v^{(l+1)} = UPDATE(h_v^{(l)}, AGGREGATE({h_u^{(l)}: u ∈ N(v)})).\nGCN (Kipf 2017): H^{(l+1)} = σ(D̃^{-1/2}ÃD̃^{-1/2}H^{(l)}W^{(l)}). Ã = A + I (self-loop). Symmetric normalization.\nGraphSAGE: sample fixed-size neighborhood, aggregate (mean/max/LSTM). Inductive — generalizes to unseen nodes.\nGAT (Graph Attention): attention weights between neighbors. α_{ij} = softmax(LeakyReLU(a^T[Whi||Whj])). Multi-head.\nExpressive power: WL (Weisfeiler-Lehman) graph isomorphism test bounds GNN expressiveness. GIN (Graph Isomorphism Net) matches WL.\nApplications: drug discovery (molecular property prediction), recommendation systems, fraud detection, traffic prediction, protein structure (AlphaFold).',
  },
  dqn_rl: {
    summary: 'DQN approximates Q-function with deep neural network using experience replay and target network for stable off-policy learning',
    explanation: 'Q-learning: Q(s,a) ← Q(s,a) + α[r + γ max_a\' Q(s\',a\') − Q(s,a)]. Converges for tabular, diverges for function approximation.\nDQN (Mnih 2015): use neural net Q_θ(s,a). Two stabilization tricks:\n1. Experience replay: store transitions in buffer D, sample random mini-batch → breaks correlations.\n2. Target network Q_{θ-}: separate network for targets, updated every C steps → reduces oscillation.\nTD error: δ = r + γ max_a\' Q_{θ-}(s\',a\') − Q_θ(s,a). MSE loss.\nImprovements: Double DQN (use online net for action selection, target for eval), Dueling (separate V and A streams), Prioritized replay (sample by TD error).\nRainbow DQN: combines 6 improvements → state-of-art Atari. DQN → 2600 Atari games superhuman.',
  },
  ppo_rl: {
    summary: 'PPO clips probability ratio to restrict policy update size, providing stable on-policy training without trust region constraints',
    explanation: 'PPO (Schulman 2017): maximize E_t[min(r_t(θ)·Â_t, clip(r_t(θ), 1−ε, 1+ε)·Â_t)] where r_t = π_θ/π_θ_old.\nClipping: prevents ratio from moving too far from 1. ε typically 0.1–0.2. Conservative update without KL penalty.\nAdvantage estimation: Â_t via GAE (Generalized Advantage Estimation): Â_t = Σ (γλ)^l δ_{t+l}. λ controls bias-variance tradeoff.\nActor-critic: shared base + policy head + value head. Train both simultaneously. Entropy bonus for exploration: −β·H(π).\nPPO-clip: simpler than PPO-KL (adaptive KL penalty). Less hyperparameter sensitive. Default in OpenAI, Anthropic RL.\nApplications: ChatGPT RLHF (PPO for reward model alignment), robotic control, game playing (OpenAI Five, AlphaStar).',
  },
  sac_rl: {
    summary: 'SAC maximizes entropy-augmented return for maximum entropy RL, achieving sample-efficient off-policy learning with automatic temperature tuning',
    explanation: 'SAC objective: max π J(π) = Σ E[r(s,a) + α·H(π(·|s))]. α: temperature balances reward vs entropy.\nSoft Q-function: Q_soft(s,a) = r + γ(Q_soft(s\',a\') − α·log π(a\'|s\')). Soft Bellman backup.\nActor: minimize KL(π(·|s) || exp(Q/α)/Z). Reparameterize: a = f_φ(s,ξ) with ξ ~ N(0,I). Squashed Gaussian policy.\nTwo Q-networks: Q_θ1, Q_θ2, take min for target → less overestimation bias (clipped double Q).\nAutomatic temperature: adjust α to target entropy H_target = −|A|. ∂J/∂α = E[-log π_t(a_t|s_t) − H_target] → dual optimization.\nSample efficiency: 10–100× more efficient than PPO on continuous control. Standard for robotics (locomotion, manipulation).',
  },
  knowledge_distillation_ml: {
    summary: 'Knowledge distillation trains small student network to match soft probability outputs of large teacher, improving student accuracy',
    explanation: 'Hinton (2015): student trained on KL(p_teacher || p_student) with temperature T softening logits before softmax.\nSoft targets: high-T softmax reveals teacher\'s learned similarity structure between classes (dark knowledge). More informative than one-hot.\nStudent loss: L = α·CE(y, p_student) + (1−α)·T²·KL(p_teacher_T || p_student_T). T=3–10 typical.\nIntermediate distillation: match hidden activations (FitNets), attention maps (AT), feature relations (RKD), gradients.\nSelf-distillation: teacher = trained version of same architecture. Born-again networks: multiple generations improve performance.\nApplications: BERT→DistilBERT (66M→40% smaller, 97% BERT performance), MobileNet training, model compression for edge deployment.',
  },
  quantization_ml: {
    summary: 'Post-training or quantization-aware training reduces model precision to INT8/INT4/INT2, reducing memory and accelerating inference',
    explanation: 'Quantization: map FP32 weights/activations to INT8: q = round(x/s + z) where s = scale, z = zero-point.\nPost-training quantization (PTQ): calibrate scale on small dataset, no retraining. INT8: minimal accuracy loss. INT4: some accuracy drop.\nQuantization-aware training (QAT): simulate quantization noise during training (fake-quantize). Straight-through estimator for gradients.\nPer-channel quantization: separate scale per output channel of conv/linear. Better accuracy than per-tensor.\nGPTQ: second-order Hessian-based weight quantization. W4A16 LLM with minimal perplexity increase. Fast PTQ.\nAWQ (Activation-aware Weight Quantization): protect salient weights based on activation magnitude. W4A16, 3× faster inference.',
  },
  gaussian_process_ml: {
    summary: 'Gaussian Process defines distribution over functions via kernel k(x,x\'); posterior gives predictions with calibrated uncertainty',
    explanation: 'GP: f(x) ~ GP(μ(x), k(x,x\')). Prior: any finite set {f(x1),...,f(xn)} ~ N(μ, K) where K_ij = k(xi,xj).\nPosterior: given observations y = f(X) + ε, ε~N(0,σ²I). Posterior: f*|X,y,X* ~ N(μ*, Σ*) analytically.\nμ* = K*^T(K+σ²I)^{-1}y. Σ* = K** − K*^T(K+σ²I)^{-1}K*. Exact uncertainty estimates.\nKernels: RBF (smooth), Matérn (roughness parameter), periodic, spectral mixture. Kernel choice encodes assumptions.\nSparse GP: inducing points Z subset for O(NM²) instead of O(N³). Variational sparse GP (SVGP) for large datasets.\nApplications: Bayesian optimization (surrogate model), spatial statistics (kriging), hyperparameter search (GPyTorch, GPflow).',
  },
  neural_architecture_search: {
    summary: 'NAS automates neural network design by searching over architecture space using RL, evolutionary algorithms, or differentiable relaxation',
    explanation: 'Search space: cell-based (stack repeated cells), chain-structured (layer types/widths), hierarchical (modules of modules).\nRL-based NAS (Zoph 2017): controller RNN generates architecture tokens, trains child network, uses accuracy as reward. 800 GPU-days originally.\nEvolutionary NAS: mutate/crossover architectures, select based on validation accuracy. REGULARIZED EVOLUTION, single-path NAS.\nDARTS (differentiable): relax discrete choice to weighted softmax over operations. Jointly train architecture weights + network weights. Efficient.\nHardware-aware NAS: multi-objective optimize accuracy + latency on target device. MnasNet, EfficientNet, ProxylessNAS.\nEfficientNet: compound scaling (width×depth×resolution jointly). EffNet-B7: 84.3% ImageNet. Found via NAS + grid search.',
  },
  bayesian_optimization: {
    summary: 'Bayesian optimization uses surrogate GP model and acquisition function to efficiently find global optimum of expensive black-box functions',
    explanation: 'BO loop: 1) Fit GP surrogate to observed (x_i, y_i). 2) Maximize acquisition function α(x). 3) Evaluate f(x_next). 4) Update GP.\nAcquisition functions: Expected Improvement EI(x) = E[max(f(x)−f*, 0)]. UCB = μ(x) + κ·σ(x). Thompson sampling.\nEI: balances exploitation (x near current best) and exploration (x with high σ). Closed-form for GP posterior.\nConvergence: sublinear cumulative regret with appropriate acquisition. Much faster than random/grid search for < 100 evaluations.\nConstraints: constrained BO for feasible regions. Multi-objective BO: Pareto frontier optimization (EHVI acquisition).\nApplications: hyperparameter tuning (Vizier, Ax/BoTorch), drug discovery, materials science, neural architecture search.',
  },
  xgboost_model: {
    summary: 'XGBoost builds additive tree ensemble by optimizing regularized second-order Taylor approximation of arbitrary loss functions',
    explanation: 'Gradient boosting: F_m(x) = F_{m-1}(x) + η·h_m(x). h_m fits negative gradient (residuals). η: shrinkage.\nXGBoost objective: L(θ) = Σl(yi, ŷi) + Σ_k Ω(fk). Ω(f) = γT + λ/2||w||². T: num leaves, w: leaf scores.\nSecond-order: Taylor expand loss → L ≈ Σ[gi·wj + hi·wj²/2] + Ω where gi = ∂l/∂ŷi, hi = ∂²l/∂ŷi². Closed-form leaf score.\nSplit finding: scan over features and thresholds for best gain. Approximate via histograms (fast GPU). Sparsity-aware.\nRegularization: γ (min gain to split), λ (L2 leaf weight). Prevents overfitting better than vanilla GBM.\nDominates tabular ML competitions (Kaggle). LightGBM: leaf-wise growth, gradient-based one-side sampling, faster.',
  },
  pca_analysis: {
    summary: 'PCA finds orthogonal axes (principal components) of maximum variance via SVD of data matrix; projects to lower-dimensional subspace',
    explanation: 'PCA: center data X → compute covariance Σ = X^TX/(n-1) → eigendecompose Σ = QΛQ^T. PCs = columns of Q.\nSVD approach: X = UΣV^T. PCs = columns of V. Singular values σi = √(n-1)·λi. More numerically stable.\nVariance explained: λi/Σλj. Choose k components explaining 95% variance (scree plot elbow rule).\nReconstruction: X̂ = (XV_k)V_k^T + mean. Reconstruction error = Σ_{i>k} λi (remaining variance).\nKernel PCA: k-PCA using kernel trick → nonlinear dimensionality reduction. k(xi,xj) = exp(-||xi-xj||²/2σ²).\nApplications: dimensionality reduction, noise filtering, face recognition (Eigenfaces), portfolio risk analysis, compression.',
  },
  tsne_embedding: {
    summary: 't-SNE minimizes KL divergence between pairwise similarity distributions in high-D and 2D space for visualization',
    explanation: 't-SNE (van der Maaten 2008): define pij = (exp(-||xi-xj||²/2σ²)) / Σ. In 2D: qij = (1+||yi-yj||²)^{-1} / Σ (t-distribution for crowding).\nObjective: minimize KL(P||Q) = Σ pij log(pij/qij) via gradient descent.\nStudent-t distribution: heavy tail in 2D prevents crowding of moderate distances. Maps widely separated clusters to visible gaps.\nPerplexity: controls effective number of neighbors (5–50). Higher: more global structure. Lower: local.\nLimitation: non-parametric (not extendable to new points), non-deterministic, O(N²) or O(N log N) with Barnes-Hut.\nParametric t-SNE: neural net learns mapping. UMAP: faster, preserves more global structure, parametric option.',
  },
  bpe_tokenization: {
    summary: 'Byte-Pair Encoding iteratively merges most frequent adjacent byte/character pairs to build subword vocabulary for LLMs',
    explanation: 'BPE algorithm: start with character vocabulary. Count all adjacent pairs. Merge most frequent pair → new token. Repeat V times.\nVocabulary size V: 30K–100K typical. Controls granularity: small V → more tokens per word; large V → rare words as single tokens.\nSentencePiece: language-agnostic BPE/Unigram tokenizer. Works on raw Unicode. Used in T5, LLaMA, Claude.\nTokenization matters: number of tokens per concept varies by language (English < Korean < rare languages). Affects cost, context length.\nSpecial tokens: [BOS], [EOS], [PAD], [MASK], [SEP]. Whitespace handling: ▁ prefix (SentencePiece), Ġ prefix (GPT-2 byte-level BPE).\nTiktoken (OpenAI): fast byte-level BPE implementation in Rust. CL100k_base: 100K vocab used in GPT-4.',
  },
  federated_learning: {
    summary: 'Federated learning trains model across many devices without centralizing data; clients train locally and share only gradients',
    explanation: 'FedAvg (McMahan 2017): server sends model to clients. Each client runs E local SGD steps on local data. Average weights: w ← Σ(nk/n)·wk.\nPrivacy: raw data never leaves client. But gradients can leak information → differential privacy (DP-SGD) needed for strong privacy.\nChallenges: non-IID data across clients (statistical heterogeneity), communication cost (compress/quantize gradients), stragglers.\nDifferential privacy: DP-SGD clips gradients per sample, adds Gaussian noise. Privacy budget ε tracks information leakage.\nFedProx: adds proximal term ||w−w^k||² to local objective → better convergence under heterogeneity.\nApplications: Google keyboard (next-word prediction), medical AI (hospital collaboration), autonomous vehicles, privacy-preserving fraud detection.',
  },
  continual_learning: {
    summary: 'Continual learning enables neural networks to learn sequential tasks without catastrophically forgetting previous tasks',
    explanation: 'Catastrophic forgetting: when trained on task B, network overwrites weights needed for task A.\nElastic Weight Consolidation (EWC): add penalty Σ Fi(θi − θ*A_i)² where Fi = Fisher information (importance of parameter θi for task A).\nProgressive Neural Networks: freeze previous task networks, add lateral connections from each new task layer to old layer outputs. No forgetting, but grows linearly.\nReplay methods: store subset of task A samples, mix with task B training. DER (Dark Experience Replay): store logits too.\nPackNet: iterative pruning and packing. After each task, prune unimportant weights, allocate remaining for next task.\nEvaluation: backward transfer (performance on old tasks after new), forward transfer (how new tasks help future tasks).',
  },
  active_learning_ml: {
    summary: 'Active learning selects most informative unlabeled samples for expert annotation, reducing labeling cost while maintaining accuracy',
    explanation: 'Query strategies: uncertainty sampling (entropy, least confidence, margin), diversity-based (coreset, cluster centers), expected model change, expected error reduction.\nEntropy sampling: query x* = argmax H(ŷ|x) = argmax −Σ p(y|x)log p(y|x). Most uncertain prediction.\nCommittee methods (query by committee): train ensemble, query where committee disagrees most. Reduces version space.\nPool-based AL: have large unlabeled pool, select B samples per round for annotation, retrain, repeat.\nBatch mode AL: select B diverse+informative samples simultaneously. Core-set: find B points covering all unlabeled points within radius ε.\nApplications: medical image annotation, NLP named entity recognition, autonomous driving data labeling. 10–100× fewer labels needed.',
  },
  rlhf_ml: {
    summary: 'RLHF trains reward model from human preference comparisons, then fine-tunes LLM with PPO to maximize reward while staying near reference policy',
    explanation: 'RLHF pipeline: 1) Supervised fine-tuning (SFT) on demonstration data. 2) Reward model (RM) trained on preference pairs. 3) RL fine-tuning with PPO.\nReward model: classify which of two responses is better. Bradley-Terry model: P(A>B) = σ(r(A)−r(B)). Train RM to maximize log P(preferred).\nPPO objective: L_PPO − β·KL(π_θ||π_SFT). KL term prevents policy from deviating too far from SFT model.\nReward hacking: model finds ways to maximize RM score without improving actual quality. RM score saturates. Requires RM updates.\nDPO (Direct Preference Optimization): bypasses RL entirely. Directly optimize implicit reward: L_DPO = −log σ(β(log π_θ(y_w|x) − log π_θ(y_l|x)) − (log π_ref(y_w|x) − log π_ref(y_l|x))).\nConstitutional AI: Claude training. Critique and revision loop + RLHF from AI feedback instead of human.',
  },
  neural_ode: {
    summary: 'Neural ODE parameterizes dynamics dh/dt = f_θ(h,t) with neural network; forward pass via ODE solver, backprop via adjoint method',
    explanation: 'ResNet: h_{t+1} = h_t + f_θ(h_t). Continuous limit: dh/dt = f_θ(h(t),t). ODE solver (RK4, Dormand-Prince) integrates from t0 to t1.\nMemory: adjoint sensitivity method computes gradients without storing forward trajectory. Run ODE backward: da/dt = −a^T ∂f/∂h.\nAdaptive step size: solver adapts step size for desired accuracy. No fixed depth — model complexity adapts to problem.\nLatent ODE: encode sequence to h0 via RNN, decode via ODE. Models irregularly sampled time series naturally.\nContinuous normalizing flows: dz/dt = f_θ(z,t). log p change: d/dt log p = −tr(∂f/∂z). Exact log-likelihood.\nApplications: irregular time series (medical, financial), physics-informed models, generative models with variable compute.',
  },
  conformal_prediction: {
    summary: 'Conformal prediction produces prediction sets with guaranteed coverage (1−α) for any distribution without distributional assumptions',
    explanation: 'Conformal prediction: for any α, P(y_test ∈ C(x_test)) ≥ 1−α. Distribution-free, finite-sample guarantee.\nSplit conformal: calibrate nonconformity scores s_i = 1−f(x_i)[y_i] on held-out calibration set. Threshold q̂ = (1−α)(n+1)/n quantile of {si}.\nPrediction set: C(x) = {y: s(x,y) ≤ q̂}. For regression: intervals y±q̂.\nExchangeability: only assumption is that (x1,y1),...,(xn,yn), (xn+1,yn+1) are exchangeable (slightly weaker than i.i.d.).\nAdaptive CP: locally adaptive intervals (larger for uncertain inputs). Mondrian CP: conditional coverage per group.\nApplications: medical diagnosis (sets of possible conditions), drug discovery, LLM uncertainty, autonomous driving safety.',
  },

  // ── MATHEMATICS ────────────────────────────────────────────────
  matrix_rank: {
    summary: 'Rank of matrix = number of linearly independent rows (or columns); equals dimension of column space and row space',
    explanation: 'Rank: r(A) = dim(col(A)) = dim(row(A)). Compute via Gaussian elimination (count non-zero pivots).\nRank-nullity theorem: rank(A) + nullity(A) = n (number of columns). Nullity = dim(null(A)).\nFull rank: rank = min(m,n). Square full-rank matrix → invertible. Rank-deficient → singular.\nLow-rank approximation: via SVD, best rank-k approximation A_k = U_k Σ_k V_k^T (Eckart-Young theorem). Minimizes ||A − A_k||_F.\nRank in ML: weight matrices in neural networks often low-rank (LoRA exploits this). Matrix completion (Netflix) assumes low rank.\nNumerical rank: rank based on tolerance τ: number of singular values > τ. SVD-based rank estimation more robust than Gaussian elimination for ill-conditioned matrices.',
  },
  svd_linear_algebra: {
    summary: 'SVD factorizes any matrix A = UΣV^T into orthogonal bases and diagonal singular values; fundamental in linear algebra and ML',
    explanation: 'SVD: A (m×n) = U (m×m orthogonal) · Σ (m×n diagonal, σ1≥σ2≥...≥0) · V^T (n×n orthogonal).\nEconomical SVD: A = U_r Σ_r V_r^T where r = rank(A). U_r: m×r, Σ_r: r×r, V_r^T: r×n.\nSingular values: σi = √λi(A^TA). Left singular vectors U: eigenvectors of AA^T. Right V: eigenvectors of A^TA.\nPseudoinverse: A^+ = VΣ^+U^T where Σ^+_ii = 1/σi for σi > 0. Solves least squares: x* = A^+b.\nApplications: PCA (V = principal components), LSA (latent semantic analysis), image compression (truncated SVD), recommendation systems (SVD++), condition number = σ_max/σ_min.',
  },
  lu_decomposition: {
    summary: 'LU decomposes A = LU into lower and upper triangular factors for efficient linear system solving via forward/back substitution',
    explanation: 'LU: A = L·U where L lower-triangular (unit diagonal), U upper-triangular. Computed by Gaussian elimination.\nPivoting: partial pivoting (PA = LU) swaps rows for numerical stability. Full pivoting (PAQ = LU) more stable, less used.\nSolving Ax=b: 1) Factor A=LU. 2) Solve Ly=b (forward substitution). 3) Solve Ux=y (back substitution). O(n³) factoring, O(n²) solve.\nMultiple RHS: factoring once, solve multiple b vectors cheaply. Efficient for factored matrix reuse.\nCholesky: A=LL^T for symmetric positive definite A. Factor cost n³/6 (2× cheaper). L: lower triangular with positive diagonal.\nApplications: finite element method, circuit simulation (SPICE), Newton\'s method (solve linear system each iteration), matrix inverse A^{-1} = U^{-1}L^{-1}P.',
  },
  eigenvalue_decomposition: {
    summary: 'Eigendecomposition A = QΛQ^{-1} for diagonalizable matrices; eigenvalues λ and eigenvectors q satisfy Aq = λq',
    explanation: 'Eigenvalue equation: Av = λv. Characteristic polynomial: det(A−λI) = 0 → n eigenvalues (counting multiplicity).\nFor symmetric A: A = QΛQ^T. Q orthogonal, Λ diagonal with real eigenvalues. Symmetric → always diagonalizable.\nComputing: QR algorithm (iterative, standard in LAPACK). Power iteration: dominant eigenvector. Lanczos (large sparse).\nSpectral theorem: symmetric real matrix has n real eigenvalues and n orthogonal eigenvectors.\nMatrix functions: A^k = QΛ^kQ^{-1}. exp(A) = Qdiag(e^λi)Q^{-1}. Useful for ODEs ẋ=Ax → x(t) = exp(At)x(0).\nRelation to SVD: eigenvalues of A^TA = σi². For symmetric PSD: eigendecomposition = SVD (V=U, σi=λi).',
  },
  gradient_descent_convergence: {
    summary: 'Gradient descent converges at rate O(1/t) for convex, O((1-μ/L)^t) for strongly convex; momentum accelerates to O(1/t²)',
    explanation: 'GD: x_{t+1} = x_t − η∇f(x_t). Step size η ≤ 1/L (L-smooth) ensures descent: f(x_{t+1}) ≤ f(x_t) − η/2||∇f||².\nConvex convergence: f(x_T) − f* ≤ ||x_0−x*||²/(2ηT). Rate O(1/T).\nStrong convexity (μ-SC): f(y) ≥ f(x) + ∇f^T(y-x) + μ/2||y-x||². Exponential convergence: ||x_t−x*||² ≤ (1-μ/L)^t||x_0-x*||².\nCondition number: κ = L/μ. Large κ → slow convergence. Preconditioning reduces effective κ.\nNesterov momentum (accelerated GD): f(x_T)−f* ≤ 2||x_0−x*||²/(η(T+1)²). Rate O(1/T²). Optimal for convex smooth.\nAdam vs GD: Adam adapts step per coordinate. Better for ill-conditioned problems. GD with line search optimal for well-conditioned.',
  },
  bayes_theorem_prob: {
    summary: 'Bayes theorem P(H|E) = P(E|H)P(H)/P(E) updates prior belief P(H) to posterior P(H|E) given observed evidence E',
    explanation: 'Bayes: P(H|E) = P(E|H)·P(H) / P(E). P(H): prior, P(E|H): likelihood, P(E): marginal (normalizer), P(H|E): posterior.\nContinuous: p(θ|x) ∝ p(x|θ)·p(θ). MAP estimate: θ_MAP = argmax p(θ|x) = argmax log p(x|θ) + log p(θ). MLE: ignore prior.\nConjugate priors: posterior has same family as prior. Beta-Binomial, Gaussian-Gaussian, Dirichlet-Categorical. Closed-form updates.\nBayesian model comparison: P(M|D) ∝ P(D|M)·P(M). Bayesian information criterion (BIC) approximates log P(D|M).\nNaive Bayes classifier: P(C|x1,...,xn) ∝ P(C)·ΠP(xi|C). Assumes feature independence given class. Effective for text classification.\nApplications: medical diagnosis, spam filtering, AB testing, hierarchical models, Kalman filter (Bayesian linear Gaussian).',
  },
  markov_chain: {
    summary: 'Markov chain: memoryless stochastic process where P(X_{n+1}|X_n,...,X_0) = P(X_{n+1}|X_n) defined by transition matrix',
    explanation: 'Transition matrix P: P_{ij} = P(X_{n+1}=j|X_n=i). Row stochastic: Σj P_{ij} = 1.\nStationary distribution: π^T = π^T P. Exists and unique if chain ergodic (irreducible + aperiodic).\nConvergence: ||P^n(x,·) − π||_TV → 0 as n→∞. Mixing time: steps to be ε-close to π.\nDetailed balance: π_i P_{ij} = π_j P_{ji} (reversibility). Sufficient (not necessary) for π to be stationary.\nAbsorbing chains: absorbing states (P_{ii}=1), transient states. Fundamental matrix N = (I-Q)^{-1} gives expected visits.\nApplications: PageRank (web graph Markov chain), hidden Markov models (speech, biology), MCMC (sampling), queueing theory, reinforcement learning MDPs.',
  },
  mcmc_basics: {
    summary: 'MCMC constructs Markov chain with desired stationary distribution π(x) to draw approximate samples from intractable posteriors',
    explanation: 'Goal: sample from π(x) ∝ f(x) where f(x) evaluable but not normalizable analytically.\nMetropolis-Hastings: propose x\' ~ q(x\'|x). Accept with prob min(1, f(x\')q(x|x\')/f(x)q(x\'|x)). Detailed balance satisfied → π is stationary.\nGibbs sampling: special case. Sample each variable conditioned on all others: xi ~ p(xi|x_{-i}). Always accept. Requires full conditionals.\nHMC (Hamiltonian Monte Carlo): use Hamiltonian dynamics (gradient info) for efficient proposals in high dimensions. No-U-Turn Sampler (NUTS) auto-tunes.\nDiagnostics: trace plots, R̂ (potential scale reduction), effective sample size (ESS), autocorrelation.\nApplications: Bayesian inference (Stan, PyMC), statistical physics, probabilistic programming (Pyro, NumPyro). HMC standard for hierarchical models.',
  },
  mle_estimation: {
    summary: 'MLE finds parameters θ* maximizing likelihood P(data|θ), equivalent to minimizing cross-entropy loss; consistent and asymptotically efficient',
    explanation: 'MLE: θ_MLE = argmax Σlog p(xi|θ). Log-likelihood avoids numerical underflow of product.\nLinear regression: MLE under Gaussian noise → least squares. Σ(yi − θ^Txi)² minimization.\nLogistic regression: MLE under Bernoulli → cross-entropy loss −Σ[yi log σ(θ^Txi) + (1-yi)log(1-σ)].\nConsistency: θ_MLE → θ* as n→∞ (under regularity conditions). Asymptotically normal: √n(θ̂−θ*) → N(0, I(θ*)^{-1}).\nFisher information: I(θ) = E[(∂log p/∂θ)²] = −E[∂²log p/∂θ²]. Cramér-Rao: Var(θ̂) ≥ 1/I(θ). MLE achieves bound asymptotically.\nConnections: MAP = MLE with log prior as regularizer. EM algorithm: iterative MLE for latent variable models.',
  },
  information_entropy: {
    summary: 'Shannon entropy H(X) = −Σ p(x)log p(x) measures average information content or uncertainty of a random variable',
    explanation: 'Entropy H(X): bits for log₂, nats for ln. Uniform distribution maximizes entropy: H = log₂N for N outcomes.\nBinary entropy: h(p) = −p log p − (1-p)log(1-p). Maximum at p=0.5 (H=1 bit), zero at p=0 or 1.\nJoint entropy: H(X,Y) = −Σ p(x,y)log p(x,y). Chain rule: H(X,Y) = H(X) + H(Y|X).\nConditional entropy: H(Y|X) = Σx p(x)H(Y|X=x). Mutual information I(X;Y) = H(X) + H(Y) − H(X,Y) = H(X) − H(X|Y).\nDifferential entropy: h(X) = −∫f(x)log f(x)dx. Gaussian maximizes h for given variance: h = 0.5 log(2πeσ²).\nKL divergence: D_KL(P||Q) = Σ P(x)log(P(x)/Q(x)) ≥ 0 (Gibbs inequality). Measures how P differs from reference Q.',
  },
  kl_divergence_math: {
    summary: 'KL divergence D_KL(P||Q) measures extra bits needed to encode P using Q\'s code; asymmetric and always non-negative',
    explanation: 'D_KL(P||Q) = Σ P(x)log(P(x)/Q(x)) = E_P[log P/Q]. Zero iff P = Q almost everywhere.\nAsymmetry: D_KL(P||Q) ≠ D_KL(Q||P). Forward KL: mean-seeking. Reverse KL: mode-seeking.\nRelation to entropy: D_KL(P||Q) = H(P,Q) − H(P). Cross-entropy H(P,Q) = −Σ P log Q ≥ H(P).\nVAE: ELBO = E[log p(x|z)] − D_KL(q(z|x)||p(z)). First term: reconstruction. Second: regularizer pushing posterior toward prior.\nJensen-Shannon divergence: JSD(P||Q) = 0.5·KL(P||M) + 0.5·KL(Q||M), M=(P+Q)/2. Symmetric, bounded [0,1 bit].\nApplications: variational inference, information-theoretic feature selection, language model perplexity = exp(H(P,Q)/n tokens).',
  },
  linear_regression_stat: {
    summary: 'Linear regression fits y = Xβ + ε; OLS estimator β̂ = (X^TX)^{-1}X^Ty is BLUE under Gauss-Markov conditions',
    explanation: 'OLS: minimize ||y − Xβ||². Solution: β̂ = (X^TX)^{-1}X^Ty = X^+y. Geometrically: projects y onto column space of X.\nGauss-Markov: if E[ε]=0, Cov(ε)=σ²I, then OLS is BLUE (Best Linear Unbiased Estimator). No normality needed for this.\nVariance: Cov(β̂) = σ²(X^TX)^{-1}. Estimate σ² = ||y−Xβ̂||²/(n−p). t-test for individual coefficients.\nR²: fraction of variance explained. R² = 1 − SSres/SStot. Adjusted R² penalizes extra parameters.\nRidge regression: β̂_R = (X^TX + λI)^{-1}X^Ty. Shrinks β toward zero. Biased but lower variance (bias-variance tradeoff).\nLASSO: L1 penalty. Sparse solutions (zero coefficients). Basis pursuit. Used for feature selection.',
  },
  graph_theory_basics: {
    summary: 'Graph G=(V,E) formalizes pairwise relationships; key properties include connectivity, degree sequences, and traversal algorithms',
    explanation: 'Graph types: directed/undirected, weighted, bipartite, planar, tree (connected acyclic). |V|=n vertices, |E|=m edges.\nDegree: undirected deg(v) = edges incident to v. Directed: in-degree + out-degree. Handshaking: Σdeg = 2|E|.\nTraversal: BFS (breadth-first, O(V+E), shortest paths unweighted), DFS (depth-first, O(V+E), topological sort, SCC).\nConnectivity: connected graph — path exists between all pairs. k-connected: removing k-1 vertices doesn\'t disconnect.\nPlanar graph: can be drawn without edge crossings. Euler: V−E+F=2 (F=faces). K5, K3,3 are non-planar (Kuratowski).\nSpectral graph theory: Laplacian L = D−A. Eigenvalues relate to connectivity (Fiedler value λ2), graph cuts, random walks.',
  },
  dynamic_programming_math: {
    summary: 'DP solves optimization problems with optimal substructure and overlapping subproblems by storing and reusing subproblem solutions',
    explanation: 'DP principles: 1) Optimal substructure (solution of problem = combination of optimal subproblem solutions). 2) Overlapping subproblems (reused many times).\nMemoization (top-down): cache recursive call results. Tabulation (bottom-up): fill table in order. Both O(states × transition cost).\nBellman equation: V(s) = max_a[R(s,a) + γ·Σ P(s\'|s,a)V(s\')]. DP for MDPs. Policy/value iteration.\nClassic problems: knapsack (O(nW)), LCS (O(mn)), edit distance (O(mn)), matrix chain (O(n³)), shortest path (Bellman-Ford O(VE)).\nSequence DP: Viterbi algorithm (HMM decoding), forward-backward (DP for marginals), CTC (speech recognition alignment).\nDP in ML: beam search (approximate DP for sequence generation), REINFORCE as policy gradient.',
  },

  // ── RF & ELECTROMAGNETICS ──────────────────────────────────────
  s_parameters_rf: {
    summary: 'S-parameters describe RF network port behavior via reflected and transmitted wave ratios; S11=reflection, S21=forward transmission',
    explanation: 'S-parameters (scattering): normalized traveling wave amplitudes. b = S·a where a=incident, b=reflected/transmitted. Referenced to Z0 (typically 50 Ω).\nS11 (input reflection): S11 = b1/a1|a2=0. |S11|² = reflected power fraction. Return loss = −20log|S11| dB. Impedance: Z_in = Z0·(1+S11)/(1−S11).\nS21 (forward gain/loss): S21 = b2/a1|a2=0. |S21|² = power transmitted. Insertion loss = −20log|S21| dB.\nMeasurement: Vector Network Analyzer (VNA). Calibration (SOLT, TRL) removes fixture/cable effects.\nS to Z/Y conversion: Z = Z0·(I+S)·(I−S)^{-1}. Y = (1/Z0)·(I−S)·(I+S)^{-1}.\nApplications: amplifier characterization (gain, stability, noise), filter insertion loss, antenna matching, PCB trace verification.',
  },
  smith_chart_rf: {
    summary: 'Smith chart is a polar plot of reflection coefficient Γ mapping impedance to graphical circles for easy impedance matching',
    explanation: 'Smith chart: complex reflection coefficient Γ = (Z−Z0)/(Z+Z0) plotted in polar form. |Γ| ≤ 1 for passive networks.\nR-circles: constant resistance r = R/Z0. X-arcs: constant reactance x = X/Z0. Origin = Z0 (Γ=0, matched load).\nNavigation: moving toward generator (clockwise, wavelengths toward generator). Adding series L: move up X-arcs. Shunt C: move on admittance circles.\nMatching: find Γ_L on chart → add elements to move to center (Γ=0). L-match, π-match, T-match sections.\nAdmittance chart: rotate Smith chart 180°. Parallel elements easier to add on Y-chart.\nApplications: antenna input impedance, amplifier matching network design, stub tuner design, transmission line impedance transformation.',
  },
  impedance_matching_rf: {
    summary: 'Impedance matching maximizes power transfer by conjugate matching Z_S = Z_L* using L-networks, stubs, or quarter-wave transformers',
    explanation: 'Maximum power transfer: P_max when Z_L = Z_S* (conjugate match). Power mismatch loss = (1−|Γ|²).\nL-network: 2-element matching (shunt+series or series+shunt). Q = √(Rmax/Rmin − 1). Bandwidth ∝ 1/Q.\nQuarter-wave transformer: Z_T = √(Z_S·Z_L) at λ/4 section. Works at single frequency (and harmonics).\nSingle-stub tuner: shunt stub (open or short circuit) placed at certain distance to cancel load susceptance.\nWideband matching: Bode-Fano limit: ∫log(1/|Γ(ω)|)dω ≤ π/RC or πL/R. Fundamental bandwidth-reflection tradeoff.\nBalun transformer: balance-unbalance. Convert between balanced (differential) and unbalanced (single-ended) RF. Ferrite or λ/4 coax.',
  },
  rf_noise_figure: {
    summary: 'Noise figure F = SNR_in/SNR_out quantifies noise added by component; cascaded NF via Friis formula dominated by first stage',
    explanation: 'Noise figure: F = SNR_in/SNR_out = 1 + T_noise/T0 where T0 = 290 K. NF_dB = 10·log(F) ≥ 0 dB.\nNoise temperature: T_e = T0·(F−1). Useful for low-noise systems (antenna, LNA).\nFriis formula (cascade): F_total = F1 + (F2−1)/G1 + (F3−1)/(G1·G2) + ... First stage dominates if G1 large.\nLNA design: minimize NF (optimal source impedance Γ_opt for noise match ≠ conjugate match for gain). Tradeoff NF vs gain.\nNoise sources: thermal (kTB at resistors), shot noise (2qIB in BJT/diode), flicker (1/f, low frequency).\nSystem noise: receiver sensitivity = kT0·B·F·SNR_min. Lower NF → better sensitivity. GPS LNA NF < 1.5 dB.',
  },
  transmission_line_rf: {
    summary: 'Transmission line supports propagating waves; characterized by Z0, propagation constant γ=α+jβ, and reflection at discontinuities',
    explanation: 'Telegrapher\'s equations: ∂V/∂z = −(R+jωL)I, ∂I/∂z = −(G+jωC)V. Wave solutions: V(z) = V+e^{-γz} + V-e^{+γz}.\nPropagation constant: γ = √((R+jωL)(G+jωC)) = α + jβ. α: attenuation (Np/m), β = 2π/λ: phase constant.\nCharacteristic impedance: Z0 = √((R+jωL)/(G+jωC)). Lossless: Z0 = √(L/C). For coax: Z0 = (138/√εr)·log(D/d).\nReflection: Γ = (ZL−Z0)/(ZL+Z0). VSWR = (1+|Γ|)/(1−|Γ|). Standing wave ratio (power mismatch visible on line).\nInput impedance: Z_in = Z0·(ZL+jZ0·tan(βl))/(Z0+jZL·tan(βl)). λ/4 transformer: Z_in = Z0²/ZL.\nMicrostrip: Z0 ≈ (87/√εr+1.41)·ln(5.98h/(0.8w+t)). εr_eff < εr (partial air fill).',
  },
  lna_design: {
    summary: 'LNA design balances minimum noise figure (noise matching), gain, stability, and linearity for sensitive receiver front-ends',
    explanation: 'Design flow: select transistor (pHEMT for GHz, BJT for low-NF), bias for low noise current, design input/output matching.\nNoise parameters: Fmin, Rn, Γ_opt. F = Fmin + (4Rn/Z0)|Γs−Γ_opt|²/(|1+Γ_opt|²(1−|Γs|²)).\nStability: K > 1 and |Δ| < 1 for unconditional stability. K = (1−|S11|²−|S22|²+|Δ|²)/(2|S12||S21|). Add source degeneration or feedback.\nInductive source degeneration: adds real part to input impedance without noise → simultaneous noise and power match possible.\nLinearity: IIP3 limited by transistor nonlinearity. Cascode LNA: better isolation (lower S12 → better stability, higher gain).\nApplications: cellular (0.5–0.9 dB NF), GPS (1 dB NF), radio astronomy (0.1 dB cryogenic LNA).',
  },
  maxwells_equations: {
    summary: 'Maxwell\'s four equations unify electricity and magnetism; predict electromagnetic waves propagating at c=1/√(με)',
    explanation: 'Gauss\'s law (electric): ∇·D = ρ_v. Total electric flux out of closed surface = enclosed free charge.\nGauss\'s law (magnetic): ∇·B = 0. No magnetic monopoles. B-field lines always closed loops.\nFaraday\'s law: ∇×E = −∂B/∂t. Changing magnetic field induces electric field (induction, transformer).\nAmpere-Maxwell: ∇×H = J + ∂D/∂t. Displacement current ∂D/∂t enables wave propagation in vacuum.\nConstitutive relations: D = εE, B = μH, J = σE. Wave equation: ∇²E = με∂²E/∂t². c = 1/√(με₀μᵣε₀εᵣ) = 3×10⁸/√(εᵣμᵣ) m/s.\nApplications: antenna radiation (oscillating J), waveguide modes (∇×E, ∇×H with boundary conditions), optical fiber (Maxwell at optical frequencies).',
  },
  skin_effect_em: {
    summary: 'High-frequency current concentrates in thin skin depth δ = √(2/ωμσ) near conductor surface, increasing effective resistance',
    explanation: 'Skin depth: δ = √(2ρ/(ωμ)) = 1/√(πfμσ). At 1 GHz, copper: δ ≈ 2.1 μm. At 60 Hz: δ ≈ 8.5 mm.\nAC resistance: R_AC = ρ·l/(P·δ) where P = perimeter. For round wire: R_AC/R_DC = a/(2δ) for a ≫ δ.\nProximity effect: conductors near each other cause non-uniform current distribution. Exacerbates AC resistance, especially in litz wire applications.\nLitz wire: multiple individually insulated thin strands, woven. Each strand sees equal flux → uniform current. Used in HF inductors, transformers.\nSurface roughness: conductor roughness increases effective path length at high frequencies. Important at > 10 GHz (PCB traces).\nMitigation in IC: wide/thin conductors (maximize surface area), copper plating, avoid thick conductors at high frequency.',
  },
  emc_basics: {
    summary: 'EMC ensures devices neither emit excessive noise nor are susceptible to external noise; requires proper grounding, shielding, and filtering',
    explanation: 'EMC = Emissions + Immunity. Regulatory standards: FCC Part 15 (US), CISPR 22/32 (international), MIL-STD-461 (military).\nEmissions: conducted (via power/signal lines, 150 kHz–30 MHz) and radiated (antenna effect, 30 MHz–6 GHz). Measured in dBμV or dBμV/m.\nNoise sources: switching regulators (PWM harmonics), clock oscillators, high dI/dt edges, I/O ports.\nCommon-mode vs differential-mode noise: CM filter: common-mode choke. DM filter: X-capacitor across supply rails.\nGrounding: single-point ground (low freq), multi-point (high freq, >1 MHz). Ground plane minimizes loop area.\nShielding: Faraday cage attenuates E-field. Magnetic shielding (μ-metal) needed for H-field. Apertures limit shielding effectiveness.',
  },
  antenna_basics_rf: {
    summary: 'Antenna converts between circuit currents and electromagnetic waves; characterized by gain, radiation pattern, impedance, and bandwidth',
    explanation: 'Antenna gain G(θ,φ) = (U(θ,φ)/P_total) × 4π. Directivity D = G/η (η = radiation efficiency). dBi: relative to isotropic.\nRadiation resistance Rrad: power radiated = I²·Rrad. Hertzian dipole: Rrad = 80π²(Δl/λ)². Half-wave dipole: Rrad = 73 Ω.\nEffective aperture: Ae = Gλ²/(4π). Friis: P_r = P_t·G_t·G_r·(λ/4πR)². Free-space path loss = (4πR/λ)².\nImpedance: complex Za = Ra + jXa. Ra = Rrad + R_loss. X_a depends on geometry, resonance at λ/2 (dipole, X_a=0).\nBandwidth: impedance BW (VSWR<2) vs pattern BW. Electrically small antennas: narrow BW, high Q = Chu limit.\nPatch antenna: resonant rectangular patch on ground plane. Gain 5–9 dBi, narrow BW (1–5%), easy PCB integration. Used in GPS, WiFi, cellular.',
  },

  // ── INFORMATION THEORY & COMMUNICATIONS ────────────────────────
  channel_capacity: {
    summary: 'Shannon channel capacity C = B·log₂(1+SNR) bits/s is the maximum error-free data rate over an AWGN channel',
    explanation: 'Shannon (1948): C = B·log₂(1+S/N). B: bandwidth (Hz), S/N: signal-to-noise ratio (linear).\nAWGN channel: additive white Gaussian noise. Channel capacity is achievable with ideal capacity-achieving codes (turbo, LDPC, polar).\nSNR-capacity tradeoff: doubling bandwidth → C increases linearly. Doubling SNR → C increases logarithmically (diminishing returns).\nShannon limit: minimum Eb/N0 for reliable communication = ln(2) ≈ −1.59 dB. Practical codes within 0.1–0.5 dB.\nMultiple antennas (MIMO): C = Σlog₂(1 + SNR·λi/Nt) bits/s/Hz where λi eigenvalues of HH^H. Linear scaling with min(Nt,Nr).\nConstrained capacity: QAM modulation limits capacity. 256-QAM provides ~8 bits/symbol. Practical rate < Shannon capacity.',
  },
  huffman_coding: {
    summary: 'Huffman code assigns shorter codewords to more probable symbols; optimal prefix-free code with average length ≤ H(X)+1',
    explanation: 'Algorithm: sort symbols by probability. Merge two lowest-probability symbols into tree node. Repeat until single root. Assign 0/1 to branches.\nOptimality: Huffman is optimal prefix-free code. Average length L: H(X) ≤ L < H(X)+1.\nPrefix-free: no codeword is prefix of another → uniquely decodable. Kraft inequality: Σ 2^{-li} ≤ 1.\nLimitation: handles symbols individually. For correlated sources or long sequences, arithmetic coding approaches entropy more closely.\nCanonical Huffman: normalized version where codes can be decoded with lookup tables. Used in DEFLATE (gzip, PNG), JPEG.\nAdaptive Huffman: updates tree as data is processed. Useful for streaming data without prior probability knowledge.',
  },
  ldpc_code: {
    summary: 'LDPC codes use sparse parity-check matrix decoded via belief propagation; near-Shannon-limit performance with linear complexity',
    explanation: 'LDPC (Gallager 1962, rediscovered 1993): H matrix is sparse (few 1s per row/column). Code rate = 1 − M/N where H is M×N.\nTanner graph: bipartite graph with variable nodes (bits) and check nodes (parity equations). Belief propagation on this graph.\nMessage passing: variable→check: pass LLR (log-likelihood ratio). Check→variable: check combines all neighbors. Iterate.\nBP decoding: sum-product algorithm (exact on cycle-free graphs), min-sum approximation (hardware-friendly). 50 iterations typical.\nCapacity: irregular LDPC (different degree distributions) within 0.0045 dB of Shannon limit (Richardson 2001). Better than turbo codes.\nStandards: DVB-S2 (satellite TV), IEEE 802.11n/ac/ax (WiFi), 5G NR, 10 GbE. BER floor from short cycles in H graph.',
  },
  polar_code: {
    summary: 'Polar codes achieve channel capacity via channel polarization, constructing synthetic channels that are either perfect or completely noisy',
    explanation: 'Arıkan (2009): apply Kronecker product F⊗n to polarize N=2^n bit-channels. Good channels (capacity→1) carry data; bad (capacity→0) carry frozen bits.\nPolarization transform: G_N = F⊗n. Encoding: x = u·G_N where u has info bits on reliable positions.\nSuccessive cancellation (SC) decoding: O(N log N). Decide bits sequentially using prior decisions.\nSC List (SCL): maintain L candidate paths. CRC-aided (CA-SCL): check CRC at list output. Near-optimal for finite N.\nBP decoding: iterative, parallelizable. Trades complexity vs latency vs performance.\nStandards: 5G NR (3GPP Rel. 15): polar codes for control channels (DCI, UCI). LDPC for data channels. Short block lengths.',
  },
  viterbi_algorithm: {
    summary: 'Viterbi algorithm finds maximum likelihood path through trellis using DP; optimal decoder for convolutional codes and HMMs',
    explanation: 'Trellis: states × time. Each branch has metric (log-likelihood). Find max-metric path from start to end.\nDP: ACS (Add-Compare-Select) at each node. Add branch metric, compare survivors, select winner. Traceback recovers path.\nConvolutional code: rate R=k/n with constraint length K. Trellis has 2^{K-1} states. Viterbi: O(2^K · N).\nHard vs soft decision: hard (binary input, Hamming distance), soft (real values, Euclidean/log-likelihood). Soft ≈ 3 dB gain.\nHMM decoding: Viterbi finds most likely state sequence given observations. Used in speech recognition (GMM-HMM era).\nBCJR algorithm: forward-backward for soft output (posterior probabilities). Used in turbo code component decoders.',
  },
  qam_modulation: {
    summary: 'QAM encodes bits in both amplitude and phase of carrier; higher-order QAM (256/1024-QAM) achieves higher spectral efficiency',
    explanation: 'QAM-M: M = 2^b constellation points in 2D grid (√M × √M). Each symbol carries b = log₂M bits.\nSignal: s(t) = I·cos(2πfct) − Q·sin(2πfct). I, Q: integer levels ±1, ±3, ..., ±(√M−1).\nSNR requirement: BER = (1−1/√M)·erfc(√(3·SNR/(M−1))/(√M))/log₂M. Higher M → better spectral efficiency but needs more SNR.\nSpectral efficiency: η = log₂(M) bits/s/Hz. 256-QAM: 8 bps/Hz. Used in cable/ADSL/WiFi when channel SNR permits.\nPAR: higher-order QAM has higher PAPR for OFDM → PA backoff needed. 5G uses up to 256-QAM DL, 64-QAM UL.\nEqualization: removes channel phase/amplitude distortion. Training pilots for channel estimation, then ZF/MMSE per subcarrier.',
  },
  ber_calculation: {
    summary: 'BER is the probability of a bit being incorrectly decoded; for BPSK over AWGN: BER = Q(√(2Eb/N0)) = erfc(√(Eb/N0))/2',
    explanation: 'BPSK: symbols ±√Eb. Decision threshold 0. BER = P(n > √Eb) = Q(√(2Eb/N0)) = 0.5·erfc(√(Eb/N0)).\nQ-function: Q(x) = P(N > x) for N~N(0,1). Q(x) ≈ (1/2)·exp(−x²/2) for large x. Cannot be computed in closed form.\nQPSK: same BER as BPSK but 2 bits/symbol. 16-QAM: BER ≈ 0.75·erfc(√(Eb/(5N0))). Each 3 dB → 1/2 BER for BPSK.\nCoding gain: with FEC code rate R, Eb_coded/N0 = (Eb/N0)_uncoded − 10log(1/R) + coding gain.\nFading channels: Rayleigh → BER ≈ 1/(4·SNR) (no diversity). MRC diversity order d: BER ∝ SNR^{-d}.\nWaterfall region: BER drops steeply with SNR for coded systems near capacity. Error floor: residual errors from code structure.',
  },
  rayleigh_fading: {
    summary: 'Rayleigh fading models envelope of sum of many reflected multipath components as Rayleigh-distributed; creates deep fades affecting mobile communications',
    explanation: 'Rayleigh fading: h = h_I + j·h_Q where h_I, h_Q ~ N(0, σ²). |h| ~ Rayleigh. |h|² ~ exponential.\nPhysical model: many scattered reflections with random amplitudes/phases add up. No line-of-sight. Central limit theorem → Gaussian.\nCoherence bandwidth B_c = 1/(5·τ_rms). Frequency separation > B_c → independent fading (frequency diversity).\nCoherence time T_c = 0.423/f_D where f_D = v·fc/c (Doppler spread). Time separation > T_c → independent fading (time diversity).\nFlat fading: signal BW < B_c. Frequency-selective: BW > B_c → ISI. OFDM makes each subcarrier flat fading.\nMitigation: antenna diversity (MRC), OFDM+coding, adaptive modulation (AMC), Rake receiver for wideband.',
  },
  // ── EMBEDDED SYSTEMS ───────────────────────────────────────────
  uart_protocol: {
    summary: 'UART transmits data asynchronously frame-by-frame: start bit + 5-9 data bits + optional parity + 1-2 stop bits',
    explanation: 'UART frame: idle (high), start bit (low), LSB-first data bits, optional parity, stop bit(s) (high). No clock signal.\nBaud rate: bits/second. Both ends must agree. Common: 9600, 115200, 921600 baud. Max on short PCB traces: ~10 Mbaud.\nParity: even (total 1-bits even), odd, none. Detects single bit errors. No correction. Often omitted, rely on upper-layer CRC.\nFlow control: hardware (RTS/CTS handshake), software (XON/XOFF). Prevents buffer overflow on slow receiver.\nRS-232: voltage standard (±3V to ±15V). RS-485: differential, multi-drop (up to 32 devices), 10 Mbps, 1200m.\nUsage: debug console (TTL UART → USB-Serial), GPS modules (NMEA sentences), microcontroller communication, legacy industrial equipment.',
  },
  spi_protocol: {
    summary: 'SPI is a 4-wire synchronous full-duplex bus (SCLK, MOSI, MISO, CS) enabling high-speed communication between master and multiple slaves',
    explanation: 'SPI signals: SCLK (clock, master), MOSI (master-out, slave-in), MISO (master-in, slave-out), CS̄ (chip select, active-low).\nOperation: master drives SCLK, asserts CS̄, shifts bits on MOSI and samples MISO simultaneously.\nCPOL (clock polarity) and CPHA (clock phase): 4 modes (0,0), (0,1), (1,0), (1,1). Both must agree. Mode 0 (CPOL=0, CPHA=0) most common.\nSpeed: up to 80 MHz for flash memory (quad SPI), 50 MHz+ typical. Full-duplex always: dummy bytes if slave has no data.\nMultiple slaves: separate CS̄ per slave (or daisy-chain). Daisy-chain: MISO of one slave → MOSI of next.\nUsage: ADC/DAC control, SPI flash (W25Q series), display controllers (ILI9341), sensors, SD cards (SPI mode).',
  },
  i2c_protocol: {
    summary: 'I2C uses 2 wires (SDA, SCL) with 7-bit addressing to connect multiple devices; open-drain bus requiring pull-up resistors',
    explanation: 'I2C (Philips, 1982): SDA (data), SCL (clock). Open-drain: devices only pull low; pull-up resistors to VDD.\nAddressing: 7-bit address → 128 devices. 10-bit addressing available. Start (SDA falls while SCL high) + address + R/W bit + ACK.\nSpeed modes: Standard (100 kbps), Fast (400 kbps), Fast-plus (1 Mbps), High-speed (3.4 Mbps), Ultra-fast (5 Mbps unidirectional).\nACK/NACK: receiver pulls SDA low (ACK) or releases (NACK) after each byte. Master terminates with stop condition.\nClock stretching: slave holds SCL low to pause master. Allows slow slave to prepare data.\nUsage: EEPROM (24Cxx), RTC (DS3231), IMU (MPU-6050), temperature sensor (LM75), power management ICs, OLED displays.',
  },
  can_bus: {
    summary: 'CAN is a differential multi-master bus for automotive/industrial control with message prioritization and robust error detection',
    explanation: 'CAN (Bosch, 1986): differential pair CANH/CANL. Dominant bit (0): CANH>CANL by 2V. Recessive (1): both ~2.5V. 1 Mbps max.\nArtibration: CSMA/CD. Multiple nodes transmit simultaneously; dominant bit wins. Node with lower ID (higher priority) wins without retry.\nFrame: SOF, 11-bit ID (CAN 2.0A) or 29-bit (CAN 2.0B extended), DLC (data length 0–8 bytes), data, CRC, ACK, EOF.\nError detection: CRC (15-bit), bit stuffing (insert opposite after 5 identical), form check, ACK check, bit monitoring.\nError confinement: TEC/REC counters. Active error → warning → passive error → bus-off. Self-recovery mechanism.\nCAN-FD: up to 8 Mbps for data phase (flexible data rate). Up to 64 bytes payload. Standard in automotive since ~2015.',
  },
  rtos_scheduling: {
    summary: 'RTOS scheduler assigns CPU to highest-priority ready task; preemptive priority scheduling guarantees worst-case response time',
    explanation: 'Task states: running, ready (waiting for CPU), blocked (waiting for event/delay), suspended.\nFixed-priority preemptive: highest-priority ready task always runs. Lower-priority task preempted immediately.\nRate Monotonic Scheduling (RMS): assign priority by rate (shorter period = higher priority). Optimal for fixed-priority. Utilization bound: U ≤ n(2^{1/n}−1) → 69% for large n.\nEDF (Earliest Deadline First): dynamic priority, optimal (100% utilization possible). Higher overhead than fixed-priority.\nContext switch: save/restore registers, PC, PSR, FPU state. On ARM Cortex-M: PendSV interrupt, ~12–20 cycles overhead.\nTick-less RTOS: suppress timer interrupts during idle → ultra-low power (FreeRTOS tickless mode, Zephyr PM).',
  },
  priority_inversion: {
    summary: 'Priority inversion occurs when high-priority task blocks on resource held by low-priority task that is preempted by medium-priority task',
    explanation: 'Scenario: Task H (high) waits for mutex held by Task L (low). Task M (medium) preempts L → H blocked by M indefinitely.\nMars Pathfinder (1997): priority inversion bug caused system resets. Fixed by enabling priority inheritance in VxWorks mutex.\nPriority inheritance protocol (PIP): when L holds mutex wanted by H, temporarily boost L\'s priority to H. Prevents M from preempting L.\nPriority ceiling protocol (PCP): assign ceiling = max priority of all tasks that might acquire resource. Task acquires only if its priority > all ceilings of other held resources.\nMutex vs semaphore: RTOS mutexes support priority inheritance, binary semaphores don\'t → always use mutex for mutual exclusion.\nDeadlock: circular wait on resources. Prevent by resource ordering (acquire locks in fixed order) or timeout.',
  },
  bootloader_design: {
    summary: 'Bootloader initializes hardware and loads application firmware; handles OTA updates and fallback to known-good image',
    explanation: 'Boot sequence: power-on → ROM bootloader → secondary bootloader (in flash) → application. ROM bootloader is immutable.\nTasks: initialize clocks/power, configure RAM, copy .data section to RAM, zero .bss, jump to application reset handler.\nDual-bank flash: bank A = running, bank B = update staging. Swap on validation success. Fallback if CRC/signature fails.\nSecure boot: verify firmware digital signature (RSA/ECDSA) before execution. Chain of trust: root key → bootloader → application.\nOTA (Over-The-Air) update: receive firmware chunks via BLE/WiFi/CAN, write to inactive bank, verify, set boot flag, reset.\nCommon: U-Boot (Linux embedded), MCUBoot (Zephyr/Mbed), custom for constrained MCUs (AVR, STM32).',
  },
  cortex_m_architecture: {
    summary: 'ARM Cortex-M is a 32-bit RISC processor optimized for embedded systems with deterministic interrupt latency and Thumb-2 ISA',
    explanation: 'Cortex-M0/M0+: ARMv6-M, minimal (ultra-low power), 1-cycle multiply. M3/M4: ARMv7-M, hardware divide, DSP instructions. M4F: FPU. M7: dual-issue, TCM. M33: ARMv8-M, TrustZone.\nThumb-2 ISA: mix of 16-bit and 32-bit instructions. Better code density than ARM (32-bit only) with near-same performance.\nNVIC (Nested Vectored Interrupt Controller): up to 240 external interrupts, 256 priority levels (configurable). Tail-chaining: 6-cycle transition between ISRs.\nException model: 16 system exceptions (Reset, NMI, HardFault, SVC, PendSV, SysTick, etc.). Vector table at 0x00000000 (remappable via VTOR).\nMemory map: 4GB linear. Code 0x00000000, SRAM 0x20000000, Peripherals 0x40000000, External 0x60000000, System 0xE0000000.\nPower modes: Run, Sleep (WFI/WFE), Deep Sleep, Standby. Wake on interrupt. Ultra-low-power M0+ draws < 5 μA/MHz.',
  },
  interrupt_latency_emb: {
    summary: 'Interrupt latency = cycles from assertion to first ISR instruction; ARM Cortex-M guarantees deterministic 12-cycle latency',
    explanation: 'Latency components: recognition (synchronize to clock), pipeline flush (abort current instruction), hardware stacking (push 8 registers), vector fetch.\nCortex-M3/M4: 12 cycles total for stacking + vector fetch (assuming zero-wait-state flash). Consistent regardless of which instruction interrupted.\nHardware stacking: automatically saves r0-r3, r12, LR, PC, xPSR onto stack. FPU: also saves S0-S15, FPSCR (25 more words).\nLate arrival: if higher-priority IRQ arrives during stacking, redirect to higher-priority ISR (no extra stack push). 12-cycle latency still.\nTail-chaining: consecutive ISRs without un-stacking. 6-cycle transition instead of un-stack+re-stack (18 cycles).\nDeterminism critical: hard real-time systems (motor control, PWM) need bounded ISR latency. RTOS adds software scheduling overhead.',
  },
  memory_protection_unit: {
    summary: 'MPU defines memory regions with access permissions; catches out-of-bounds accesses and enforces task isolation in RTOS systems',
    explanation: 'MPU: hardware unit that checks every memory access against region table. Violation → MemManage fault exception.\nRegions: Cortex-M MPU supports 8–16 regions. Each region: base address, size (32B–4GB, power of 2), access permissions, execute-never (XN).\nAccess attributes: privileged/unprivileged R/W/X combinations. User tasks marked unprivileged. OS code privileged.\nTask isolation: each RTOS task gets its own MPU configuration. Cannot corrupt other tasks\' stack or data.\nStack overflow detection: place no-access region below stack. Stack overflow triggers MemManage fault before corruption.\nARM Cortex-M33 (ARMv8-M) MPU: 8+8 regions (NS+S), PMSA v8 alignment improvements, background region support.',
  },
  low_power_mcu: {
    summary: 'MCU low-power design uses sleep modes, clock gating, voltage scaling, and careful peripheral management to extend battery life',
    explanation: 'Power modes: Active (full operation), Sleep (CPU halted, peripherals active), Deep Sleep (most clocks off, RAM retained), Standby (all off except wakeup logic, state lost).\nRun current: STM32L4 at 4 MHz, 1.2V → ~30 μA/MHz. Deep sleep with RTC: ~1 μA. Shutdown: ~20 nA.\nPower optimization: disable unused peripherals (AHB/APB clock gates), reduce CPU frequency when idle, use peripheral DMA (CPU sleeps during transfers).\nSubthreshold leakage: static power from CMOS leakage. Reduced with lower VDD. MCU voltage scaling: 1.2V vs 1.8V → ~30% dynamic power saving.\nWake-up time: shutdown → active: milliseconds (PLL startup). Deep sleep → active: microseconds. Tradeoff: wake latency vs power saved.\nCurrent profiler: Segger J-Trace PPK, Otii Arc, STM32 current measurement. Identify dominant consumers (LDO quiescent, ADC).',
  },
  linker_script: {
    summary: 'Linker script defines memory regions and section placement, controlling where .text, .data, .bss sections are located in ROM and RAM',
    explanation: 'Memory regions: MEMORY { FLASH (rx) : ORIGIN=0x08000000, LENGTH=512K; RAM (xrw) : ORIGIN=0x20000000, LENGTH=128K; }\nSections: .text (code, const data) → FLASH. .data (initialized global vars) → FLASH for init values, copied to RAM on startup. .bss (zero-init globals) → RAM.\nStartup code: copies .data from flash LMA (load address) to RAM VMA (virtual address). Zeroes .bss region. Calls SystemInit, then main().\nStack/heap: stack grows down from top of RAM. Heap grows up. _Stack_Top = RAM + LENGTH. Linker symbols used by startup.\nSection attributes: KEEP() prevents garbage collection of interrupt vectors. DISCARD removes unused sections.\nCommon issues: insufficient RAM for .data+.bss+stack, overlapping sections, missing __attribute__((section)) for TCM/DMA buffers requiring specific placement.',
  },
  secure_boot_emb: {
    summary: 'Secure boot cryptographically verifies firmware signature before execution, establishing hardware root of trust from OTP keys',
    explanation: 'Chain of trust: immutable ROM bootloader → verify secondary BL signature → verify application signature → execute.\nPublic key stored in OTP (one-time programmable) fuses or secure element. Private key never leaves secure signing server.\nSignature algorithms: RSA-2048/4096, ECDSA P-256 (preferred for size), Ed25519. Hash: SHA-256 or SHA-384.\nSTM32: option bytes + RDP (read-out protection) level 2 = fully locked (JTAG disabled). Secure boot via ST Trusted Package Creator.\nKey rollback prevention: monotonic counter in OTP/secure storage. Prevents downgrade to older vulnerable firmware version.\nSide-channel: power analysis, fault injection (glitching VCC or clock) can bypass software checks. Hardware secure element provides physical protection.',
  },
  pwm_embedded: {
    summary: 'PWM generates variable duty-cycle square wave for motor control, LED dimming, and DAC approximation using timer capture-compare unit',
    explanation: 'PWM: timer counts 0→ARR (Auto-Reload Register). Compare register CCR sets duty cycle. Output high when counter < CCR.\nFrequency: f_PWM = f_tim / (PSC+1) / (ARR+1). PSC: prescaler. ARR: period. Resolution: bits = log₂(ARR+1).\nDead-time (complementary PWM): small gap between high-side and low-side MOSFET to prevent shoot-through. Configurable in advanced timers.\nPhase-correct PWM: count up+down (triangle wave). Center-aligned PWM: less spectral noise, used in motor FOC.\nThree-phase motor control: 3 complementary PWM pairs with 120° phase offset. Space vector PWM (SVPWM) maximizes linear modulation range.\nResolution vs frequency tradeoff: higher ARR → better duty cycle resolution, lower frequency. Digital power conversion typical 100 kHz PWM at 10-bit resolution.',
  },
  swd_jtag: {
    summary: 'SWD (2-wire) and JTAG (4/5-wire) provide debug access to embedded MCUs for breakpoints, memory inspection, and flash programming',
    explanation: 'JTAG (IEEE 1149.1): TCK, TMS, TDI, TDO, optional TRST. Daisy-chain multiple devices (TAP scan chain). Supports boundary scan.\nSWD (Serial Wire Debug, ARM): SWDIO (bidirectional data), SWDCLK. 2-wire replaces JTAG 4-wire. Same DAP (Debug Access Port) underneath.\nDebug features: hardware breakpoints (FPB, 6 in Cortex-M3/M4), watchpoints (DWT, 4), ITM trace (SWO pin printf), ETM trace (instruction trace).\nOpenOCD: open-source debug host. Supports GDB server for GDB/VS Code debugging. Vendor tools: J-Link (Segger), ST-Link, DAPLink.\nFlash programming: via debug probe SWD → send flash unlock sequence → program via DAP-AP → reset. Faster than serial bootloader.\nSecurity: RDP (read-out protection) disables debug access on production devices. RDP level 2 irreversible (fuses).',
  },


  // ════ B7 ════


  // ── OPERATING SYSTEMS & DISTRIBUTED SYSTEMS ───────────────────
  os_process_scheduling: {
    summary: 'OS scheduler selects which process runs on CPU; algorithms include FCFS, SJF, Round Robin, and multilevel feedback queues',
    explanation: 'Preemptive vs non-preemptive: preemptive scheduler can interrupt running process. Non-preemptive runs until voluntary yield or block.\nRound Robin (RR): each process gets time quantum q. If not finished, goes to back of ready queue. q=10-100ms typical. Balance responsiveness vs overhead.\nMultilevel Feedback Queue (MLFQ): multiple queues with decreasing priority. New process enters highest queue; drops if uses full quantum. CPU-bound fall, I/O-bound stay high.\nShortest Job First (SJF): optimal for average wait time (non-preemptive). Requires burst time prediction. SRTF: preemptive SJF.\nMetrics: CPU utilization, throughput, turnaround time, waiting time, response time. Different algorithms optimize different metrics.\nLinux CFS (Completely Fair Scheduler): uses red-black tree ordered by virtual runtime (vruntime). Picks leftmost (least vruntime) node.',
  },
  virtual_memory_os: {
    summary: 'OS virtual memory system manages page tables, demand paging, and page replacement to give processes isolated address spaces',
    explanation: 'Demand paging: pages loaded only when accessed (page fault). Reduces startup time, enables larger working sets than physical RAM.\nPage fault handler: check if valid access (check page table) → if not present, find free frame → read page from disk → update PTE → resume.\nPage replacement algorithms: FIFO (simplest), LRU (optimal approximation, costly to implement exactly), Clock (second chance, FIFO with use bit), Optimal (Belady: evict farthest future use — theoretical baseline).\nBelady\'s anomaly: more frames can cause MORE faults with FIFO. Not with LRU or stack algorithms.\nWorking set model: W(t,Δ) = set of pages accessed in last Δ references. If resident set < working set → thrashing.\nTLB shootdown: page table changes require TLB invalidation on all CPUs. Expensive on NUMA systems (IPI broadcast).',
  },
  file_system_basics: {
    summary: 'File system organizes data on storage into files and directories; key structures include inodes, FAT, and B-trees for metadata',
    explanation: 'Inode (UNIX): stores metadata (size, timestamps, owner, permissions, data block pointers). Separate from filename (directory maps name→inode).\nBlock allocation: fixed-size blocks (4KB typical). Fragmentation: internal (last block partially filled), external (non-contiguous blocks).\nFAT (File Allocation Table): chain of block numbers. Simple but slow for large files (traverse chain). FAT32: 4GB file limit.\next4: journaling filesystem. Journal records pending operations → survives crash. Extents (contiguous block ranges) replace indirect blocks.\nZFS / Btrfs: copy-on-write (COW) semantics. Never overwrite data in place → consistent snapshots. Built-in RAID, checksums.\nB-tree directories: HFS+, NTFS, ext4 dir_index. O(log n) file lookup vs linear for small dirs. Critical for directories with 100K+ files.',
  },
  ipc_mechanisms: {
    summary: 'IPC (Inter-Process Communication) mechanisms: pipes, message queues, shared memory, sockets, and signals for process coordination',
    explanation: 'Pipe: unidirectional byte stream, in-kernel buffer. Anonymous pipe: parent↔child. Named pipe (FIFO): any process.\nMessage queue: structured messages with types. POSIX mq_send/mq_receive. Persists beyond sender lifetime. Priority ordering.\nShared memory: fastest IPC (no copy). mmap(MAP_SHARED) or shm_open. Requires explicit synchronization (semaphore, mutex).\nDomain socket: full-duplex, connection-oriented (SOCK_STREAM) or datagram (SOCK_DGRAM). Faster than TCP loopback. D-Bus, systemd use it.\nSignals: async notification. SIGINT (Ctrl+C), SIGTERM (graceful shutdown), SIGSEGV (segfault), SIGKILL (cannot catch). signal()/sigaction().\nD-Bus / gRPC: higher-level IPC frameworks. gRPC: protobuf serialization over HTTP/2. Used in microservices, container orchestration.',
  },
  synchronization_primitives: {
    summary: 'Mutex, semaphore, condition variable, and spinlock coordinate concurrent access to shared resources in OS and user-space',
    explanation: 'Mutex (mutual exclusion lock): only one thread holds at a time. POSIX: pthread_mutex_lock/unlock. Non-recursive: deadlock if same thread acquires twice.\nCondition variable: wait for condition while atomically releasing mutex. pthread_cond_wait(cond, mutex) — avoids busy-wait. Signal wakes one waiter; broadcast wakes all.\nSemaphore: counter-based. sem_wait (P): decrement, block if 0. sem_post (V): increment, wake waiter. Binary semaphore ≈ mutex but without ownership.\nSpinlock: busy-wait loop testing lock bit. Low latency when lock held briefly, wastes CPU if held long. Good for kernel, bad for user-space.\nRead-write lock: multiple concurrent readers OR one exclusive writer. pthread_rwlock. Useful for read-heavy data structures.\nLock-free structures: avoid OS locks entirely using CAS atomics. Higher performance under contention but harder to implement correctly.',
  },
  memory_allocator: {
    summary: 'Memory allocator manages heap; malloc/free use strategies like free lists, slab allocator, or buddy system to minimize fragmentation',
    explanation: 'malloc implementation: glibc ptmalloc, jemalloc, tcmalloc. Manage arena of pages from OS (brk/mmap).\nFree list: doubly-linked list of free chunks. First-fit, best-fit, worst-fit policies. Coalesce adjacent free chunks on free().\nBuddy system: split/merge blocks in power-of-2 sizes. Fast, low fragmentation. Used in Linux kernel (kmalloc zones).\nSlab allocator: pre-allocate pools of fixed-size objects. Near-zero fragmentation for kernel objects. Per-CPU cache for hot path.\nFragmentation: internal (wasted bytes in allocated block), external (free space not contiguous for large request). Compaction too expensive at runtime.\njemalloc (Firefox, Redis): size-class segregated fits, thread-local caches, huge page awareness. 20-30% faster than glibc.',
  },
  distributed_consensus: {
    summary: 'Distributed consensus (Raft, Paxos) achieves agreement among faulty nodes; tolerates f failures with 2f+1 nodes',
    explanation: 'Problem: agree on single value across N nodes where up to f may crash. FLP impossibility: no deterministic protocol in async network (Fischer-Lynch-Paterson 1985).\nPaxos: two phases. Phase 1 (Prepare): propose ballot n, get promises. Phase 2 (Accept): if quorum promised, send accept(n,v).\nRaft (Ongaro 2014): leader-based, more understandable than Paxos. Leader election via randomized timeouts. Log replication: leader appends, replicates to majority, commits.\nSafety: committed entry (replicated on majority) never overwritten. Liveness: leader eventually elected if majority up.\nViewstamped Replication, Multi-Paxos, Zookeeper ZAB: variants. etcd, Consul, ZooKeeper use Raft/ZAB for distributed coordination.\nByzantine fault tolerance: Raft tolerates crash-stop failures. PBFT/HotStuff handles Byzantine (arbitrary behavior). Needs 3f+1 nodes.',
  },
  cap_theorem: {
    summary: 'CAP theorem: distributed system can guarantee only 2 of 3: Consistency, Availability, Partition tolerance',
    explanation: 'CAP (Brewer 2000, Gilbert-Lynch proof 2002): during network partition, choose C (all nodes return same data) or A (system responds, possibly stale).\nCP systems: sacrifice availability during partition. ZooKeeper, HBase, MongoDB (majority reads). Bank transactions → choose C.\nAP systems: sacrifice consistency during partition. Cassandra, CouchDB, DNS. Eventually consistent. Return possibly stale data.\nPAXELC refinement: adds latency dimension. Even without partition: trade E(latency) vs C(consistency).\nStrong vs eventual consistency: strong (linearizability) = reads always see latest write. Eventual = all replicas converge eventually.\nPractical: "2-of-3" oversimplified. Modern systems tune consistency level per operation (Cassandra: ONE/QUORUM/ALL).',
  },
  mapreduce_model: {
    summary: 'MapReduce splits big data computation into parallel Map (key-value transformation) and Reduce (aggregation) phases across clusters',
    explanation: 'Map phase: input records → emit (key, value) pairs. Each mapper processes one input split independently. Embarrassingly parallel.\nShuffle & sort: framework groups all values by key, sorts, routes to reducer. Network bottleneck for large datasets.\nReduce phase: (key, [v1,v2,...]) → output. Aggregate, summarize, join. One reducer per key group.\nFault tolerance: detect worker failure via heartbeat → re-execute failed tasks on another worker. Deterministic map/reduce idempotent.\nHadoop MapReduce: Java, HDFS storage. Spark: in-memory DAG, 100× faster for iterative algorithms (ML). Flink: streaming.\nLimitations: poor for iterative algorithms (each iteration = full MR job), small files problem, high latency vs OLAP.',
  },
  distributed_storage: {
    summary: 'Distributed file systems (HDFS, GFS, Ceph) stripe data across nodes for scalability with replication for fault tolerance',
    explanation: 'GFS/HDFS: large files (64–128 MB blocks), sequential read/write optimized, 3-way replication. Master/NameNode holds metadata.\nHDFS write: client → NameNode gets block locations → pipeline write to 3 DataNodes → ack chain. Heartbeat checks node liveness.\nCeph: distributed object store with no central metadata bottleneck. CRUSH algorithm places objects deterministically without lookup table.\nObject storage (S3, GCS): flat namespace, HTTP API, versioning, lifecycle policies. Highly durable (11 nines). Cheap bulk storage.\nConsistency models: HDFS eventual (NameNode is bottleneck, still single master). Ceph: strong consistency via Paxos for metadata.\nErasure coding: instead of 3× replication, use Reed-Solomon (k data + m parity) → recover k original from any k of k+m chunks. Less space overhead.',
  },
  microservices_arch: {
    summary: 'Microservices decompose monolithic app into independently deployable services communicating via HTTP/gRPC or message queues',
    explanation: 'Principles: single responsibility, independent deployability, polyglot (each service chooses own tech stack), decentralized data management.\nService discovery: services register in registry (Consul, Kubernetes DNS). Client queries registry for service endpoint.\nCircuit breaker pattern: trip after N failures → fast-fail requests → attempt recovery after timeout. Hystrix, Resilience4j.\nAPI gateway: single entry point for clients. Load balancing, auth, rate limiting, SSL termination, response caching. Kong, NGINX, Envoy.\nSaga pattern: distributed transactions via sequence of local transactions + compensating transactions on failure. Choreography vs orchestration.\nObservability: distributed tracing (Jaeger, Zipkin, OpenTelemetry), centralized logs (ELK stack), metrics (Prometheus + Grafana).',
  },
  kubernetes_containers: {
    summary: 'Kubernetes orchestrates containers across a cluster, providing automated deployment, scaling, self-healing, and service discovery',
    explanation: 'Pod: smallest deployable unit. 1+ containers sharing network namespace and volumes. Scheduled on a Node.\nDeployment: declares desired state (replicas, image). ReplicaSet maintains desired pod count. RollingUpdate strategy: gradual pod replacement.\nService: stable virtual IP + DNS for pod set. Types: ClusterIP (internal), NodePort, LoadBalancer (cloud LB), ExternalName.\nScheduler: assigns pods to nodes based on resource requests/limits, affinity rules, taints/tolerations.\nPersistent volumes: decoupled from pod lifecycle. StorageClass → dynamic provisioning. StatefulSet: stable identity + ordered deployment for databases.\nService mesh (Istio, Linkerd): sidecar proxy per pod. mTLS, traffic shaping, circuit breaking, observability without app code changes.',
  },
  // ── NETWORKING ─────────────────────────────────────────────────
  tcp_ip_stack: {
    summary: 'TCP/IP 4-layer model: application, transport (TCP/UDP), internet (IP), link; provides reliable byte-stream or unreliable datagram delivery',
    explanation: 'TCP (Transmission Control Protocol): connection-oriented, reliable, ordered. 3-way handshake (SYN, SYN-ACK, ACK). 4-way teardown.\nFlow control: receiver advertises window size. Sender cannot exceed window. Prevents buffer overflow.\nCongestion control: slow start (exponential), congestion avoidance (additive increase), fast retransmit/recovery (on 3 dup ACKs). CUBIC, BBR algorithms.\nUDP: connectionless, no reliability, no ordering. Low latency. Used for real-time (VoIP, gaming, video), DNS, QUIC.\nIP: best-effort datagram routing. IPv4: 32-bit. IPv6: 128-bit. Fragmentation if MTU exceeded. TTL prevents infinite loops.\nQUIC (HTTP/3): UDP-based, TLS 1.3 built-in, 0-RTT resumption, multiple streams. Eliminates TCP head-of-line blocking.',
  },
  bgp_routing: {
    summary: 'BGP is the internet\'s inter-domain routing protocol exchanging reachability information between autonomous systems (AS)',
    explanation: 'BGP (Border Gateway Protocol): path vector protocol. Each AS has unique ASN. Route advertisements contain AS-PATH.\niBGP (internal): within same AS. eBGP (external): between ASes. iBGP peers must be fully meshed or use route reflectors.\nPath selection: prefer highest LOCAL_PREF → shortest AS_PATH → lowest MED → eBGP over iBGP → lowest IGP cost → router-ID.\nRoute filtering: prefix lists, community tags, route maps. ISPs apply filters to prevent route leaks and BGP hijacking.\nBGP hijacking: malicious/mistaken AS announces more-specific prefix → traffic redirected. BGPsec + RPKI provides cryptographic origin validation.\nConvergence: BGP can take minutes after topology change. Fast BGP: BFD (Bidirectional Forwarding Detection) detects link failure in <1s.',
  },
  http_https: {
    summary: 'HTTP/1.1 adds persistent connections; HTTP/2 multiplexes streams; HTTP/3 (QUIC) eliminates HOL blocking; HTTPS adds TLS encryption',
    explanation: 'HTTP/1.1: persistent connection (keep-alive), pipelining (limited by HOL blocking), chunked transfer encoding, conditional requests (ETag).\nHTTP/2: binary framing, header compression (HPACK), stream multiplexing (multiple requests on one TCP connection), server push.\nHTTP/3: QUIC (UDP-based). Eliminates TCP HOL blocking — packet loss in one stream doesn\'t affect others. 0-RTT connection resumption.\nTLS 1.3: 1-RTT handshake (vs 2-RTT in TLS 1.2). Forward secrecy mandatory (ECDHE). Deprecated weak ciphers.\nHTTPS: TLS wraps HTTP. Certificate verification: browser trusts CA-signed certificate. HSTS forces HTTPS. CT (Certificate Transparency) detects misissuance.\nREST vs gRPC: REST (text/JSON, human-readable) vs gRPC (binary protobuf, strongly typed, faster, streaming). gRPC preferred for microservices.',
  },
  cdn_caching: {
    summary: 'CDN places content at edge servers near users; reduces latency and origin load via HTTP caching (Cache-Control, ETag, CDN PoPs)',
    explanation: 'CDN (Content Delivery Network): distributed PoPs (Points of Presence). Serves static assets, streams, dynamic acceleration.\nCache-Control: max-age (TTL in seconds), no-store (no caching), no-cache (revalidate before use), public/private. Set by origin.\nETag / Last-Modified: conditional requests. If-None-Match: <etag> → 304 Not Modified if unchanged. Saves bandwidth.\nOrigin shield: CDN layer between PoPs and origin. Collapses cache misses. Protects origin from traffic spikes.\nAnycasting: CDN uses anycast IP — DNS/BGP routes user to nearest PoP automatically. Low latency globally.\nEdge computing (Cloudflare Workers, Lambda@Edge): run code at CDN edge. Personalization, A/B testing, auth without round-trip to origin.',
  },

  // ════ B8 ════


  // ── POWER ELECTRONICS ─────────────────────────────────────────
  flyback_converter: {
    summary: 'Flyback converter uses transformer for galvanic isolation; energy stored in magnetizing inductance during on-time, transferred during off-time',
    explanation: 'Flyback: modified buck-boost with transformer (coupled inductor). Primary switch on → energy stored in Lm. Switch off → secondary diode conducts.\nVout/Vin = (Ns/Np)·D/(1−D) (DCM). CCM: Vout/Vin = (Ns/Np)·D/(1−D) + Lm effects. Turns ratio sets output voltage level.\nLeakage inductance: primary leakage causes voltage spike on switch turn-off → snubber (RCD clamp or active clamp).\nFlyback advantages: simple, isolated, multiple outputs, wide Vin range. Disadvantage: large transformer, high peak currents.\nActive clamp flyback (ACF): recycles leakage energy, enables ZVS, higher efficiency at low power. Used in USB-PD chargers.\nApplications: AC-DC adapters (phone/laptop chargers), auxiliary supply in industrial, off-line power supply < 150W.',
  },
  llc_resonant_converter: {
    summary: 'LLC series-resonant converter achieves ZVS/ZCS through resonant tank, enabling high efficiency at high frequency (MHz)',
    explanation: 'LLC: half-bridge switches + series Lr, Cs resonant tank + parallel Lm. Two resonant frequencies: fr1 = 1/(2π√LrCr), fr2 = 1/(2π√(Lr+Lm)Cr).\nOperating at fr1: ZVS for MOSFETs (primary side), ZCS for diodes (secondary). Minimum circulating current.\nGain curve: voltage gain M vs normalized frequency fn. At fn=1 → M = n (turns ratio). Gain < n for fn > 1 (boost region forbidden).\nFrequency modulation: adjust switching frequency to regulate Vout. Narrow frequency range preferred (fr1 ± 20%).\nHigh efficiency: 97-98% achievable at 1 MHz. Enables high power density. Used in data center PSUs, EV onboard chargers.\nSR (Synchronous Rectification): replaces secondary diodes with MOSFETs. Driver from SR controller or gate winding. Reduces secondary conduction loss.',
  },
  pfc_boost_converter: {
    summary: 'Power Factor Correction forces AC input current to be sinusoidal and in-phase with voltage, achieving PF>0.99 using boost converter',
    explanation: 'PF (Power Factor) = P/(V_rms·I_rms). Nonlinear load draws pulsed current → harmonics → PF < 1, increases utility losses.\nPFC boost: input rectifier + boost converter with current-mode control. Reference: i_ref(t) = k·|Vac(t)|·duty cycle correction.\nAverage current mode control: inner current loop tracks sinusoidal reference. Outer voltage loop regulates Vbus (400VDC typical from 230VAC).\nTHD (Total Harmonic Distortion): IEC 61000-3-2 requires THD < specified limits per equipment class. PFC achieves < 5% THD.\nBridgeless PFC: eliminates input rectifier bridge → lower conduction loss. Totem-pole PFC (GaN): synchronous, > 99% efficiency.\nApplications: PC PSUs (80 PLUS standard requires PF > 0.9 at 50% load), EV chargers, industrial drives. Mandatory > 75W in EU.',
  },
  dc_dc_converter_types: {
    summary: 'DC-DC converter topologies: isolated (flyback, forward, LLC, DAB) vs non-isolated (buck, boost, buck-boost, SEPIC)',
    explanation: 'Non-isolated: Buck (step down), Boost (step up), Buck-Boost (invert), SEPIC (step up/down, non-inverting), Ćuk (step up/down, inverting).\nIsolated: Flyback (< 150W), Forward (< 300W), Push-Pull (two switches), Half-Bridge (two switches + two caps), Full-Bridge (four switches, > 500W).\nBidirectional DC-DC: four-quadrant operation. DAB (Dual Active Bridge): H-bridges on both sides + transformer. Soft-switching, wide Vrange.\nGaN-based converters: fast switching (100ns), low Qg → MHz operation, small passives, high power density. Used in USB-PD GaN chargers.\nWide bandgap: SiC MOSFET for > 650V (EV inverter), GaN for < 650V (chargers, telecom). RDS_on·Qg FOM 5-10× better than Si.\nConverter selection criteria: voltage ratio, isolation requirement, power level, efficiency target, switching frequency, cost.',
  },
  motor_drive_control: {
    summary: 'Motor drive controls inverter switches to regulate speed/torque of AC induction or PMSM motors via FOC or DTC algorithms',
    explanation: 'Field-Oriented Control (FOC): decompose stator current into flux-producing (Id) and torque-producing (Iq) components in rotating dq frame.\nClarke transform: 3-phase (a,b,c) → stationary (α,β). Park transform: (α,β) → rotating (d,q) aligned with rotor flux.\nCurrent control: two PI controllers (Id, Iq loops). Fast inner loop (1-10 kHz). Outer speed/position loop (100 Hz-1 kHz).\nDTC (Direct Torque Control): directly selects voltage vector to control flux and torque. Fast response, no current loops. Torque ripple higher.\nPMSM: permanent magnet synchronous motor. Back-EMF ~ speed. Id=0 control common. MTPA (max torque per ampere) for efficiency.\nSVM (Space Vector Modulation): optimal use of DC bus voltage. 15% more peak voltage than SPWM. Standard in modern motor drives.',
  },
  battery_management_system: {
    summary: 'BMS monitors cell voltage, temperature, and current to estimate SOC/SOH, balance cells, and protect against over/under-voltage',
    explanation: 'SOC (State of Charge): remaining capacity fraction. Estimated via Coulomb counting (integrate current) + OCV (open-circuit voltage) correction.\nSOH (State of Health): capacity fade and internal resistance increase over charge cycles. Li-ion: 80% SOH at 500-1000 cycles.\nCell balancing: passive (bleed resistors on high-voltage cells, simple, wasteful), active (shuttle charge between cells, complex, efficient).\nProtection: over-voltage (> 4.2V/cell), under-voltage (< 2.5-3.0V), over-temperature, over-current, short-circuit. MOSFET switches disconnect pack.\nBattery models: equivalent circuit model (ECM: Thevenin circuit with Voc(SOC), R0, RC pairs). Kalman filter for SOC estimation.\nThermal management: liquid cooling (cold plate under cells), air cooling. Li-ion optimal 20-40°C. Thermal runaway propagation prevention critical for EVs.',
  },
  inverter_design: {
    summary: 'Power inverter converts DC to AC using H-bridge switches with PWM control; single-phase or 3-phase for motor drives and grid-tied solar',
    explanation: '3-phase inverter: 6 switches (3 half-bridges), 120° phase-shifted outputs. DC bus capacitor holds voltage during switching.\nSPWM: compare sinusoidal reference with triangular carrier → switching instants. Fundamental output = (m_a/2)·Vdc. Linear modulation: m_a ≤ 1.\nSVM: superior DC bus utilization (1/√3 × Vdc for SPWM → (2/3) × Vdc for SVM, ~15% improvement).\nDead time: IGBT/SiC turn-on/turn-off delay requires dead-time (100ns-1μs). Causes voltage distortion → dead-time compensation needed.\nGrid-tied inverter: PLL (Phase-Locked Loop) synchronizes to grid. Current control in dq frame. Unity PF or reactive power injection.\nIslanding detection: grid-tied inverter must detect grid disconnect and stop within 2 seconds (IEEE 1547). Passive (voltage/freq deviation) or active methods.',
  },
  // ── COMPUTER SECURITY ─────────────────────────────────────────
  symmetric_encryption: {
    summary: 'Symmetric encryption uses same key for encrypt/decrypt; AES-256 is standard block cipher, ChaCha20 for stream applications',
    explanation: 'AES (Advanced Encryption Standard): 128-bit block, 128/192/256-bit keys. Substitution-permutation network (SPN). 10/12/14 rounds.\nAES operations per round: SubBytes (S-box, nonlinear), ShiftRows (permutation), MixColumns (diffusion), AddRoundKey (key XOR).\nModes of operation: ECB (insecure, parallel), CBC (IV chaining, padding oracle risk), CTR (stream mode, parallelizable), GCM (authenticated encryption).\nAES-GCM: AES-CTR encryption + GHASH authentication. Single key, single pass, provides confidentiality + integrity + authentication.\nChaCha20-Poly1305: stream cipher + MAC. No timing side-channels (no S-box table lookups). Used in TLS 1.3, WireGuard, QUIC.\nKey management: most important aspect. HSM for key storage, key derivation (HKDF, PBKDF2), key rotation, key escrow.',
  },
  public_key_cryptography: {
    summary: 'Asymmetric cryptography uses public/private key pairs; RSA relies on factoring hardness, ECC on discrete log on elliptic curves',
    explanation: 'RSA: N = p·q (large primes). Encrypt: c = m^e mod N. Decrypt: m = c^d mod N where e·d ≡ 1 (mod φ(N)). Security: factoring N.\nRSA-2048: 2048-bit key, equivalent ~112-bit symmetric. RSA-4096 for long-term security. Slow vs ECC.\nECDSA (Elliptic Curve DSA): P-256, P-384, Curve25519. 256-bit key ≈ RSA-3072. Faster signing/verification, smaller keys.\nDiffie-Hellman key exchange: agree on shared secret without transmitting it. ECDH: elliptic curve version. Used in TLS 1.3 (ECDHE).\nForward secrecy: ephemeral keys (ECDHE) ensure compromising long-term key doesn\'t decrypt past sessions. Required in TLS 1.3.\nPost-quantum: Kyber (lattice-based KEM), Dilithium (signatures) — NIST PQC standards. Quantum computers break RSA/ECC via Shor\'s algorithm.',
  },
  hash_functions: {
    summary: 'Cryptographic hash functions produce fixed-size digest from arbitrary input; SHA-256/SHA-3 provide collision resistance and preimage resistance',
    explanation: 'Properties: preimage resistance (given H(m), hard to find m), second-preimage resistance, collision resistance (hard to find m≠m\' with H(m)=H(m\')).\nSHA-256: Merkle-Damgård construction, 256-bit output, 64 rounds of compression. Used in TLS, Bitcoin PoW, code signing.\nSHA-3 (Keccak): sponge construction, different design from SHA-2. More conservative security assumption, hardware-friendly.\nMD5/SHA-1: broken for collision resistance (practical collisions found). Do not use for security. Still used for non-security checksums.\nHMAC: H(K XOR opad || H(K XOR ipad || message)). Provides message authentication using shared key + hash function.\nApplications: digital signatures, password storage (bcrypt/scrypt/Argon2 — slow KDF), blockchain, certificate fingerprints, deduplication.',
  },
  tls_protocol: {
    summary: 'TLS (Transport Layer Security) provides authenticated, encrypted channel; TLS 1.3 completes handshake in 1 RTT with forward secrecy',
    explanation: 'TLS 1.3 handshake: ClientHello (key shares) → ServerHello (key share, cert, finished) → Client finished. Application data from first server message.\nKey exchange: ECDHE (X25519 or P-256). Generates ephemeral shared secret → derive handshake and application keys via HKDF.\nCipher suites TLS 1.3: TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256. All provide AEAD.\nCertificate validation: X.509 cert chain from leaf to CA root in trust store. Check expiry, revocation (OCSP, CRL), SANs match hostname.\n0-RTT resumption: resumption_master_secret → PSK. Send early data with first flight. Replay risk for non-idempotent requests.\nMTLS (mutual TLS): both client and server present certificates. Used in microservices (Istio, service mesh), API clients.',
  },
  common_vulnerabilities: {
    summary: 'OWASP Top 10 includes injection, broken auth, XSS, IDOR, SSRF; require input validation, parameterized queries, and least-privilege principles',
    explanation: 'SQL Injection: unescaped input in SQL query → attacker executes arbitrary SQL. Prevention: parameterized queries (prepared statements), ORM.\nXSS (Cross-Site Scripting): inject malicious scripts into web page seen by other users. Reflected (response), stored (database), DOM-based. CSP headers.\nCSRF: trick authenticated user into submitting request. Prevention: CSRF token (synchronizer token pattern), SameSite cookie attribute.\nBroken Access Control: IDOR (Insecure Direct Object Reference) — change ID in URL to access others\' data. Enforce authorization server-side.\nSSRF (Server-Side Request Forgery): attacker makes server fetch arbitrary URLs → access internal services. Block private IP ranges, whitelist.\nBuffer overflow: write past array bounds → overwrite return address. Prevention: ASLR, stack canaries, NX (no-execute), bounds checking (Rust, safe C++17).',
  },

  // ════ B9 ════


  // ── ADVANCED ML & AI ──────────────────────────────────────────
  lstm_cell: {
    summary: 'LSTM uses forget, input, and output gates plus cell state to selectively remember long-term dependencies in sequences',
    explanation: 'LSTM (Hochreiter & Schmidhuber 1997): cell state Ct carries long-range information. Three gates control flow.\nForget gate: ft = σ(Wf·[ht-1, xt] + bf). Decides what to discard from cell.\nInput gate: it = σ(Wi·[ht-1,xt]+bi). Candidate: C̃t = tanh(Wc·[ht-1,xt]+bc). Update: Ct = ft⊙Ct-1 + it⊙C̃t.\nOutput gate: ot = σ(Wo·[ht-1,xt]+bo). ht = ot⊙tanh(Ct).\nGradient flow: cell state path has additive updates → gradient can flow without vanishing through many timesteps.\nGRU (Gated Recurrent Unit): simpler (2 gates), comparable performance. Reset gate + update gate. Standard for many sequence tasks.',
  },
  attention_mechanism_ml: {
    summary: 'Attention computes weighted sum of values based on query-key similarity, allowing models to focus on relevant parts of input',
    explanation: 'Attention: Attention(Q,K,V) = softmax(QK^T/√dk)·V. Q: queries, K: keys, V: values. All projections of input.\nScaled dot-product: divide by √dk to prevent softmax saturation for large dk (variance of dot product scales with dk).\nSelf-attention: Q=K=V=input. Each position attends to all positions in same sequence. Captures global dependencies.\nCross-attention: Q from decoder, K,V from encoder. Standard in seq2seq transformers (translation, summarization).\nMulti-head attention: h independent attention heads, concatenated, projected. Each head can attend to different aspects.\nComplexity: O(n²·d) in sequence length n. Linear attention (Performer, Linformer) approximates for long sequences.',
  },
  transformer_architecture: {
    summary: 'Transformer uses stacked self-attention + feed-forward layers with residual connections; replaced RNNs for NLP and now vision/audio',
    explanation: 'Encoder block: Multi-head self-attention → Add&Norm → Feed-forward (2-layer MLP, dim 4×d_model) → Add&Norm.\nDecoder block: masked self-attention → cross-attention (attends encoder output) → feed-forward. All with residual connections + LayerNorm.\nPositional encoding: sin/cos at different frequencies (original), or learned embeddings (BERT, GPT). Injects position info.\nScaling: d_model=512 (original), GPT-3 uses d_model=12288, 96 layers, 175B params. Larger = better, power-law scaling.\nPre-LN vs Post-LN: Pre-LayerNorm (LN before attention) more stable training. Used in GPT-2+.\nEfficiency tricks: FlashAttention (IO), gradient checkpointing (memory), mixed precision (BF16), tensor parallelism (across GPUs).',
  },
  gan_training: {
    summary: 'GAN training alternates generator G and discriminator D updates in minimax game; suffers from mode collapse and vanishing gradients',
    explanation: 'Minimax: min_G max_D E[log D(x)] + E[log(1−D(G(z)))]. D tries to distinguish real/fake, G tries to fool D.\nTraining instability: if D too strong → G gradient vanishes (log(1-D(G(z))) saturates). Practical: maximize log D(G(z)) for G.\nMode collapse: G maps multiple z → same output mode (ignores generator diversity). Wasserstein GAN (WGAN) mitigates via Earth Mover distance.\nWGAN: replace sigmoid with linear D output + weight clipping (or gradient penalty WGAN-GP). Provides meaningful gradient everywhere.\nGAN variants: StyleGAN2 (high-quality faces), BigGAN (class-conditional, large scale), CycleGAN (unpaired image-to-image), Pix2Pix (paired).\nDiffusion models largely replaced GANs for image generation quality, but GANs remain faster for inference.',
  },
  vae_model: {
    summary: 'VAE learns continuous latent space via encoder q(z|x) and decoder p(x|z); trained by maximizing ELBO = reconstruction − KL divergence',
    explanation: 'VAE (Kingma & Welling 2014): encoder outputs μ,σ (parameters of q(z|x)). Decoder p(x|z) reconstructs from sampled z.\nELBO: L = E[log p(x|z)] − KL(q(z|x)||p(z)). Reconstruction term + regularization toward prior N(0,I).\nReparameterization trick: z = μ + σ⊙ε, ε~N(0,I). Enables backprop through stochastic sampling.\nPosterior collapse: if decoder too powerful, ignores z (KL term collapses to 0). Fix: β-VAE (weight KL by β>1), free bits.\nLatent space: smooth, interpolatable. Can traverse between concepts. Disentangled representations (β-VAE).\nHierarchical VAE: multiple latent levels (NVAE, VDVAE). High-quality images approaching GAN quality. VQ-VAE: discrete latents.',
  },
  normalizing_flows: {
    summary: 'Normalizing flows learn invertible transformations f: z→x with tractable Jacobian, enabling exact density estimation and sampling',
    explanation: 'Flow: x = f(z), z~N(0,I). log p(x) = log p_z(f^{-1}(x)) + log|det ∂f^{-1}/∂x|. Exact log-likelihood if Jacobian tractable.\nAffine coupling layer (RealNVP): split x into x1,x2. x2_transformed = x2 ⊙ exp(s(x1)) + t(x1). Triangular Jacobian → det = Σsi.\nActNorm: learned affine per-channel normalization (like data-dependent BN). Bijective.\nGlow: 1×1 invertible convolutions + affine coupling. High-quality image synthesis + exact density.\nAutoregressive flows (MAF, IAF): x_i depends on x_{<i}. Flexible but slow sampling (MAF) or slow density eval (IAF).\nApplications: density estimation, anomaly detection, variational inference (normalizing posterior), sample generation.',
  },
  model_compression: {
    summary: 'Model compression reduces size and inference cost via pruning, quantization, knowledge distillation, and low-rank factorization',
    explanation: 'Structured pruning: remove entire filters/heads/layers. Hardware-friendly (reduces matrix dimensions). Less flexible than unstructured.\nUnstructured pruning: zero out individual weights based on magnitude or gradient. High sparsity (90%+) but requires sparse matmul hardware.\nQuantization-aware training (QAT): simulate quantization during training using straight-through estimator. Better accuracy than PTQ for INT4.\nLow-rank factorization: decompose W (m×n) = UV where U(m×r), V(r×n), r≪min(m,n). LoRA applies this to fine-tuning only.\nKnowledge distillation: student learns from teacher soft targets. DistilBERT: 40% smaller, 97% BERT accuracy. TinyBERT: task-agnostic.\nSparsity + quantization: combine for maximum compression. Sparse quantized models: 4-bit + 50% sparsity = 8× compression vs FP32.',
  },
  object_detection_ml: {
    summary: 'Object detection locates and classifies objects; two-stage (Faster R-CNN) or one-stage (YOLO, SSD, DETR) approaches',
    explanation: 'Two-stage: Region Proposal Network (RPN) → RoI pooling → classification + regression. Faster R-CNN: ~5 FPS, high accuracy.\nOne-stage detectors: YOLO (You Only Look Once) — grid cells predict boxes+classes in single forward pass. YOLOv8: ~100 FPS, competitive accuracy.\nAnchor boxes: predefined aspect ratios and scales. Regression predicts offsets from anchor. Anchor-free (FCOS, CenterNet): predict from keypoints.\nDETR (Transformer-based): treats detection as set prediction. No NMS needed. Bipartite matching loss. Slower training convergence.\nMetrics: mAP (mean Average Precision) @ IoU thresholds (0.5, 0.5:0.95). IoU = intersection/union of predicted vs GT box.\nApplications: autonomous vehicles (pedestrian/car detection), security cameras, medical imaging (lesion detection), satellite imagery.',
  },
  semantic_segmentation: {
    summary: 'Semantic segmentation classifies every pixel; FCN, U-Net, DeepLab use encoder-decoder or atrous convolutions for dense prediction',
    explanation: 'FCN (Fully Convolutional Network): replace FC layers with convolutions → output spatial map, not vector. Any input size.\nU-Net: encoder (contracting) + decoder (expanding) with skip connections. Preserves fine spatial details. Standard in medical imaging.\nDeepLab: atrous (dilated) convolutions increase receptive field without pooling. ASPP (Atrous Spatial Pyramid Pooling) captures multi-scale context.\nTransformer segmentation: SegFormer, Mask2Former use ViT backbone. Global context + multi-scale features.\nInstance vs semantic: semantic = class per pixel (no object separation). Instance = separate each object. Panoptic = both.\nMetrics: mIoU (mean Intersection over Union). Pixel accuracy. Boundary F1 for edge quality.',
  },
  speech_recognition_ml: {
    summary: 'ASR converts audio to text using acoustic model + language model; Whisper uses seq2seq transformer trained on 680k hours of speech',
    explanation: 'Traditional ASR: acoustic model (GMM-HMM or DNN-HMM) + pronunciation lexicon + n-gram language model. Beam search decoding.\nCTC (Connectionist Temporal Classification): RNN outputs blank + characters, CTC loss marginalizes over all valid alignments. No alignment labels needed.\nSeq2seq (LAS, Whisper): encoder (audio features) → attention → decoder (text tokens). Whisper: log-Mel spectrogram → CNN → Transformer.\nWhisper: 680k hours multilingual. Robust to accents, noise. Zero-shot transcription, translation, language ID.\nSelf-supervised speech: wav2vec 2.0, HuBERT. Pretrain on unlabeled audio → fine-tune with < 1 hour labeled data.\nStreaming ASR: RNN-T (Recurrent Neural Network Transducer) enables low-latency token-by-token streaming output. Used in Google Assistant.',
  },
  // ── PHYSICS ────────────────────────────────────────────────────
  quantum_mechanics_basics: {
    summary: 'Quantum mechanics governs subatomic behavior: wave-particle duality, superposition, and measurement collapse described by Schrödinger equation',
    explanation: 'Wave function ψ(x,t): probability amplitude. |ψ|² = probability density. Normalization: ∫|ψ|²dx = 1.\nSchrödinger equation: iℏ∂ψ/∂t = Ĥψ. Time-independent: Ĥψ = Eψ. Ĥ = −ℏ²/2m·∇² + V(x).\nQuantization: energy levels discrete for bound states. Particle in box: En = n²π²ℏ²/(2mL²). Hydrogen atom: En = −13.6/n² eV.\nHeisenberg uncertainty: Δx·Δp ≥ ℏ/2. Not due to measurement disturbance but fundamental property of quantum states.\nSuperposition: quantum system in multiple states simultaneously until measured. Measurement collapses to eigenstate.\nEntanglement: correlated quantum states where measurement on one instantly determines the other (no FTL communication).',
  },
  quantum_computing_basics: {
    summary: 'Quantum computers use qubits (superposition + entanglement) and quantum gates to solve certain problems exponentially faster',
    explanation: 'Qubit: |ψ⟩ = α|0⟩ + β|1⟩, |α|²+|β|²=1. Bloch sphere representation. Measurement collapses to |0⟩ or |1⟩ probabilistically.\nQuantum gates: unitary matrices. Hadamard H = (|0⟩+|1⟩)/√2 creates superposition. CNOT entangles two qubits.\nShor\'s algorithm: factorizes N in O(log²N) time (quantum) vs O(exp(log^{1/3}N)) classical. Breaks RSA/ECC. Needs ~1000 logical qubits.\nGrover\'s search: finds item in unsorted N-item database in O(√N) queries vs O(N) classical. Quadratic speedup.\nDecoherence: interaction with environment destroys quantum state. Current hardware: ~100-1000 physical qubits per logical qubit with QEC.\nNISQ era: Noisy Intermediate-Scale Quantum. VQE (molecular simulation), QAOA (combinatorial). Not yet fault-tolerant.',
  },
  solid_state_physics: {
    summary: 'Solid state physics describes electron behavior in crystalline lattices via band theory, Fermi-Dirac statistics, and crystal momentum',
    explanation: 'Bloch theorem: electron wavefunction in periodic potential: ψ_k(r) = u_k(r)·e^{ik·r}. u_k periodic with lattice. Crystal momentum ℏk.\nEnergy bands: allowed energy ranges. Bandgap Eg between valence and conduction band. Conductor (overlapping bands), insulator (large Eg), semiconductor (small Eg).\nFermi-Dirac distribution: f(E) = 1/(exp((E-EF)/kT)+1). At T=0: step function at EF. Fermi energy EF separates filled/empty states.\nDensity of states g(E): number of states per unit energy. 3D free electron: g(E) ∝ √E. Quantum dots: discrete levels.\nPhonons: quantized lattice vibrations. Thermal conductivity (heat transport) and electron scattering (mobility reduction at high T).\nHall effect: magnetic field deflects current carriers → transverse voltage. Measure carrier type (n or p) and density. Hall sensor applications.',
  },
  thermodynamics_laws: {
    summary: 'Four laws of thermodynamics govern energy, entropy, and equilibrium; fundamental to heat engines, refrigeration, and information theory',
    explanation: '0th law: thermal equilibrium is transitive → defines temperature. If A≡B and B≡C then A≡C.\n1st law: ΔU = Q − W. Energy conservation. Internal energy U increases with heat Q absorbed, decreases with work W done.\n2nd law: entropy S of isolated system never decreases. ΔS ≥ 0. No perfect heat engine. Carnot efficiency η = 1 − TC/TH.\n3rd law: entropy approaches constant (usually 0) as T → 0 K. Absolute zero unattainable in finite steps.\nFree energy: Helmholtz F = U − TS (constant V,T); Gibbs G = U − TS + pV (constant p,T). Minimized at equilibrium. ΔG < 0 → spontaneous.\nInformation-theoretic connection: Landauer principle: erasing one bit generates kT·ln(2) heat. Maxwell\'s demon resolved via erasure.',
  },

  // ════ B10 ════

  // ── DATABASES ──────────────────────────────────────────────────
  relational_model_db: {
    summary: 'Codd\'s relational model organizes data into relations (tables) with rows and columns, governed by relational algebra and functional dependencies.',
    explanation: 'Core operations: σ (select rows), π (project columns), ⋈ (natural join), ∪, −, ×.\nFunctional dependency X→Y: knowing X determines Y; basis for normalization.\nCandidate key: minimal set of attributes uniquely identifying a tuple.\nRelational algebra is procedural; relational calculus (SQL basis) is declarative.\nIntegrity constraints: entity integrity (PK not null), referential integrity (FK must reference existing PK).',
  },
  sql_joins_types: {
    summary: 'SQL joins combine rows from two tables based on a related column; each join type handles non-matching rows differently.',
    explanation: 'INNER JOIN: only matching rows. LEFT/RIGHT OUTER: include all rows from one side, NULL for no match. FULL OUTER: all rows from both sides.\nImplementations: Hash join O(n+m)—build hash on smaller table, probe with larger; optimal for large tables.\nSort-Merge join O(n log n)—sort both, merge; efficient when inputs already sorted (index scan).\nNested Loop O(n×m)—good only with index on inner; used by optimizer when selectivity is high.\nEXPLAIN ANALYZE shows actual join method, rows, cost; critical for query tuning.',
  },
  database_normalization: {
    summary: 'Normalization eliminates redundancy and update anomalies by decomposing relations into well-structured forms based on functional dependencies.',
    explanation: '1NF: atomic (non-repeating) attribute values, no nested sets.\n2NF: 1NF + no partial dependency on primary key (PK must be minimal).\n3NF: 2NF + no transitive dependency (non-key → non-key via non-key).\nBCNF (Boyce-Codd): every determinant is a candidate key—stricter than 3NF.\nDenormalization: intentionally add redundancy for read performance (star schema in OLAP).\nHeath\'s theorem: loss-less decomposition if R1∩R2 → R1 or R1∩R2 → R2.',
  },
  acid_properties: {
    summary: 'ACID properties guarantee reliable transaction processing: Atomicity, Consistency, Isolation, and Durability.',
    explanation: 'Atomicity: transaction commits entirely or rolls back entirely—WAL (write-ahead log) enables rollback.\nConsistency: transaction takes DB from one valid state to another; application-defined invariants (balance ≥ 0).\nIsolation: concurrent transactions appear to execute serially; isolation level controls trade-offs.\nDurability: committed data survives crashes—WAL flushed to disk before commit acknowledgement.\nImplementation: MVCC (PostgreSQL) gives readers a snapshot without locking writers; 2PL (traditional) uses shared/exclusive locks.',
  },
  transaction_isolation_levels: {
    summary: 'Isolation levels define the visibility of uncommitted data between concurrent transactions, trading anomaly prevention for concurrency.',
    explanation: 'READ UNCOMMITTED: sees dirty reads (uncommitted data)—rarely used.\nREAD COMMITTED (default PG): no dirty reads; non-repeatable reads possible (same row read twice may differ).\nREPEATABLE READ: snapshot at tx start; phantoms possible (new rows matching predicate).\nSERIALIZABLE: full isolation—SSI (Serializable Snapshot Isolation) in PostgreSQL detects rw-conflicts.\nSQL anomalies: dirty read, non-repeatable read, phantom read, write skew (serializable prevents all).\nMVCC: each row version tagged with xmin/xmax; readers see consistent snapshot without blocking writers.',
  },
  btree_index_db: {
    summary: 'B+ Tree indexes store all data in sorted leaf pages linked in a doubly-linked list, enabling efficient point lookups and range scans.',
    explanation: 'B+ Tree: internal nodes hold keys only; leaves hold key+TID (tuple ID) pairs linked for range scans.\nHeight = O(log_B n) where B (branching factor) ≈ block size / key size ≈ 100-1000.\nPoint lookup: O(log_B n) = typically 3-4 I/Os for billion-row table.\nRange scan: descend to first key, traverse leaf chain—very I/O efficient.\nIndex selectivity: high-selectivity index (few rows per key) reduces random I/Os; low-selectivity → seq scan cheaper.\nCovering index (index-only scan): includes all projected columns, avoids heap fetch.',
  },
  query_optimization_db: {
    summary: 'The query optimizer transforms SQL into an efficient execution plan by estimating costs of alternative physical operators and join orderings.',
    explanation: 'Stages: parse → bind → logical plan → physical plan selection (cost-based optimizer).\nStatistics: column histograms, n-distinct, correlation—used for cardinality estimation.\nJoin ordering: dynamic programming (System R style) over n! orderings; heuristics for >10 tables.\nPlan operators: seq scan, index scan, hash join, sort-merge join, hash aggregate, window function.\nCost model: I/O cost + CPU cost; planner tunable via seq_page_cost, random_page_cost.\nEXPLAIN ANALYZE: shows actual vs estimated rows—large mismatch → stale stats (run ANALYZE).',
  },
  postgresql_mvcc: {
    summary: 'PostgreSQL\'s MVCC gives each transaction a consistent snapshot by maintaining multiple row versions, so readers never block writers.',
    explanation: 'Each row has xmin (inserted by) and xmax (deleted by) transaction IDs; visible if xmin committed and xmax not yet committed at snapshot time.\nSnap shot: list of in-progress xids at tx start; rows from those xids are invisible.\nDead tuples: rows deleted/updated leave old versions; VACUUM reclaims space, advances oldest xmin horizon.\nHOT (Heap-Only Tuple): update stays on same page, avoids index entry duplication; requires enough space.\nBloat: heavy UPDATE workloads accumulate dead tuples—monitor with pgstattuple; autovacuum settings critical.\npg_stat_activity, pg_locks: diagnose long-running transactions blocking VACUUM.',
  },
  nosql_types: {
    summary: 'NoSQL databases trade SQL query power and ACID for horizontal scalability, flexible schemas, and specialized data models.',
    explanation: 'Key-value (Redis, DynamoDB): O(1) get/set by key; no query on values; ideal for cache, session, leaderboard.\nDocument (MongoDB, Couchbase): JSON/BSON documents with nested structures; secondary indexes; richer queries than KV.\nWide-column (Cassandra, HBase): rows with arbitrary columns grouped into column families; optimized for time-series, write-heavy.\nGraph (Neo4j): nodes + edges with properties; Cypher query language; excellent for relationship traversal.\nSelection criteria: access pattern determines choice; NoSQL avoids JOIN cost at expense of denormalization.',
  },
  lsm_tree_storage: {
    summary: 'Log-Structured Merge Trees optimize writes by buffering in memory and periodically merging sorted runs on disk, used in RocksDB, Cassandra, and LevelDB.',
    explanation: 'Write path: append to WAL + insert into in-memory MemTable (sorted skip list or red-black tree).\nFlush: MemTable written as immutable SSTable (Sorted String Table) on disk when full.\nCompaction: background merging of SSTables into larger levels—removes tombstones, deduplicates, maintains sort order.\nRead path: check MemTable → L0 SSTables → L1... → Bloom filter per SSTable to skip irrelevant files.\nWrite amplification: data written multiple times during compaction (10-30× typical); tunable with compaction strategy.\nLeveled compaction (RocksDB default) vs Size-tiered (Cassandra); space amplification tradeoff.',
  },
  vector_database: {
    summary: 'Vector databases store high-dimensional embeddings and support approximate nearest neighbor (ANN) search for semantic similarity queries.',
    explanation: 'Use case: retrieve semantically similar documents/images/products via embedding proximity rather than exact match.\nHNSW (Hierarchical Navigable Small World): layered graph, O(log n) search; high recall at <10 ms for millions of vectors.\nIVF (Inverted File): cluster vectors into nlist centroids; search only nearby clusters—fast, lower recall than HNSW.\nProduct Quantization (PQ): compress vectors (1536d float → 64 bytes) for memory efficiency; slight recall loss.\nPinecone, Weaviate, Qdrant, pgvector (PostgreSQL extension). Key metrics: recall@10, QPS, memory footprint.\nRAG (Retrieval-Augmented Generation): embed query → ANN search → inject top-k chunks into LLM context.',
  },
  time_series_db: {
    summary: 'Time-series databases are optimized for timestamped numeric data with high ingest rates, time-range queries, and automatic downsampling.',
    explanation: 'Storage: columnar per metric, delta encoding for timestamps (Δt), XOR compression for float values (Gorilla/Facebook).\nInfluxDB: measurement + tag set + field set + timestamp; tag indexed (inverted index), fields not indexed.\nTimescaleDB: PostgreSQL extension, automatic partitioning into hypertable chunks by time; native SQL.\nPrometheus: pull-based scrape, TSDB with 2-hour in-memory blocks + compacted disk blocks; PromQL query language.\nDownsampling/retention: reduce resolution for old data; continuous aggregates (TimescaleDB) for real-time rollups.\nCardinality: tag combination explosion is primary scaling challenge (high-cardinality labels)',
  },
  redis_data_structures: {
    summary: 'Redis is an in-memory data structure store supporting Strings, Lists, Hashes, Sets, Sorted Sets, HyperLogLog, and Streams.',
    explanation: 'String: up to 512MB; integers stored as int (INCR is atomic O(1)); SETEX for TTL.\nList: doubly-linked list (LPUSH/RPOP for queue; LRANGE for pagination); quicklist encoding for small lists.\nHash: HSET/HGET; ziplist encoding when small; ideal for object fields.\nSorted Set (ZADD): skip list + hash; O(log n) rank operations; range by score (leaderboard, delayed queue with ZRANGEBYSCORE).\nHyperLogLog: probabilistic cardinality estimation with <1% error using 12KB; PFADD/PFCOUNT.\nStreams (XADD/XREAD): append-only log with consumer groups—Kafka-lite for lightweight event streaming.',
  },
  cassandra_wide_column: {
    summary: 'Cassandra is a leaderless wide-column store optimized for high write throughput and geographic distribution, requiring query-first data modeling.',
    explanation: 'Partition key: hashed via Murmur3 → placed on ring node (consistent hashing); determines data locality.\nClustering columns: sort data within partition; enable efficient range queries within a partition.\nData modeling: design table per query pattern—no joins, no aggregations across partitions.\nTunable consistency: ONE (fastest, least durable) → QUORUM (majority) → ALL (strongest); write/read separately tunable.\nLSM storage: CommitLog + MemTable → SSTable flush + compaction (SizeTiered or Leveled).\nRepair/hinted handoff: reconcile diverged replicas; read repair on mismatched data during reads.',
  },
  database_sharding: {
    summary: 'Sharding horizontally partitions data across multiple database nodes by a shard key to scale beyond single-node limits.',
    explanation: 'Range sharding: shard by value range (user_id 0-999999 → shard 1); simple but hot spots on sequential keys.\nHash sharding: shard = hash(key) % N; uniform distribution but range queries span all shards.\nConsistent hashing: nodes placed on ring; only adjacent keys remapped when node added/removed (minimizes rebalancing).\nCross-shard operations: transactions require 2PC (expensive); aggregations require scatter-gather; joins impractical.\nDirectory-based sharding: lookup service maps keys to shards; flexible but single point of failure.\nVitess (MySQL), Citus (PG), native sharding in MongoDB: automate routing, resharding, and query planning.',
  },

  // ── ALGORITHMS ─────────────────────────────────────────────────
  sorting_algorithms: {
    summary: 'Sorting algorithms arrange elements in order; comparison-based sorts have a theoretical lower bound of Ω(n log n).',
    explanation: 'Quicksort: pivot partition, average O(n log n), worst O(n²); randomized pivot avoids worst case; in-place, cache-friendly.\nMergesort: divide-and-conquer, stable, O(n log n) guaranteed; O(n) extra space; preferred for linked lists.\nHeapsort: O(n log n) in-place, not stable; poor cache behavior due to random access in heap.\nTimsort (Python, Java): hybrid merge+insertion sort; exploits natural runs; O(n) best case for nearly sorted data.\nCounting/Radix sort: O(kn) non-comparison; radix sort stable (LSD → MSD); effective for integers, strings with bounded alphabet.\nDecision tree lower bound: any comparison sort needs ≥ log₂(n!) comparisons ≈ n log n − n (Stirling).',
  },
  binary_search_tree_ops: {
    summary: 'A binary search tree maintains the invariant that left subtree keys < root < right subtree keys, enabling O(h) search, insert, and delete.',
    explanation: 'BST invariant: for every node, all left descendants < node.key < all right descendants.\nOperations: search, insert, delete all O(h); h = O(log n) balanced, O(n) degenerate (sorted input).\nDelete: 3 cases—leaf (remove), one child (bypass), two children (replace with in-order successor/predecessor).\nIn-order traversal: visits nodes in sorted order O(n).\nSuccessor: leftmost node of right subtree; predecessor: rightmost of left subtree.\nMotivation for balanced BSTs: guarantee O(log n) by maintaining height invariant (AVL, Red-Black, B-Tree).',
  },
  red_black_tree: {
    summary: 'Red-black trees are self-balancing BSTs that guarantee O(log n) operations by enforcing coloring invariants through rotations and recoloring.',
    explanation: 'Properties: (1) every node red or black, (2) root is black, (3) no two consecutive red nodes, (4) all paths to null have same black-height.\nHeight guarantee: ≤ 2 log₂(n+1); black-height = h/2 minimum.\nInsertion: add as red leaf → fix violations with uncle-color-based rotation/recolor cases (3 cases).\nDeletion: replace with successor, fix double-black property (6 cases).\nUsed in: Linux CFS scheduler (tasks sorted by vruntime), C++ std::map/set, Java TreeMap, Nginx.\nAVL trees: more strictly balanced (height diff ≤ 1), faster lookup but slower insert/delete.',
  },
  hash_table_design: {
    summary: 'Hash tables provide expected O(1) insert, lookup, and delete by mapping keys to array slots via a hash function and handling collisions.',
    explanation: 'Hash function: uniform distribution over slots; avalanche effect—small key change → completely different hash.\nChaining: linked list at each bucket; load factor α = n/m; average O(1+α), worst O(n) with adversarial input.\nOpen addressing: probe sequence on collision—linear probing (cache-friendly, primary clustering), quadratic (secondary clustering), double hashing (best distribution).\nRobin Hood hashing: minimize max probe length by swapping richer-for-poorer; constant lookup.\nResize: when α > 0.7, double array and rehash all keys—amortized O(1) per insert.\nUniversal hashing: h(k) = ((ak+b) mod p) mod m with random a,b → O(1) expected regardless of keys.',
  },
  heap_priority_queue: {
    summary: 'A binary heap implements a priority queue with O(log n) insert and extract-min/max, stored compactly as an array.',
    explanation: 'Max-heap property: parent ≥ children; stored in array: parent(i) = (i-1)/2, children 2i+1 and 2i+2.\nInsert: append + sift-up O(log n); Extract-max: swap root with last, shrink, sift-down O(log n).\nHeapify (build heap from array): bottom-up sift-down, O(n)—not O(n log n).\nD-ary heap: reduces sift-down cost for insert-heavy workloads; used in Dijkstra with d=4.\nFibonacci heap: decrease-key O(1) amortized (lazy merging of heap-ordered trees); theoretically optimal for Dijkstra O(V log V + E).\nApplications: task scheduler, Dijkstra/A*, huffman coding, k-way merge, median maintenance.',
  },
  graph_traversal_algo: {
    summary: 'BFS and DFS are fundamental graph traversal algorithms used for connectivity, shortest paths, cycle detection, and topological ordering.',
    explanation: 'BFS: queue-based; visits nodes in order of distance from source; O(V+E); finds shortest path in unweighted graph.\nDFS: stack/recursion; O(V+E); classifies edges as tree/back/forward/cross; discovers finish times.\nDFS timestamps: discovery time d[u] and finish time f[u]—back edge → cycle; f[u] > f[v] → u before v in topo sort.\nSCC (Strongly Connected Components): Kosaraju (2 DFS passes), Tarjan (single DFS with low-link values).\nBipartite check: BFS/DFS 2-color; bipartite iff no odd-length cycle.\nApplications: web crawling (BFS), maze solving (DFS), dependency resolution (DFS topo sort), network flow.',
  },
  dijkstra_shortest_path: {
    summary: 'Dijkstra\'s algorithm finds single-source shortest paths in graphs with non-negative edge weights using a greedy priority-queue approach.',
    explanation: 'Algorithm: maintain dist[] initialized to ∞ (source 0); repeatedly extract min-distance unvisited node u, relax outgoing edges.\nCorrectness: once extracted, dist[u] is final—guaranteed because all weights ≥ 0 (no shorter path through unvisited node).\nComplexity: O((V+E) log V) with binary heap; O(V² + E) with array (dense graphs); O(E + V log V) with Fibonacci heap.\nBidirectional Dijkstra: run simultaneously from source and target; stop when frontiers meet—roughly halves search space.\nA* (heuristic Dijkstra): f(n) = g(n) + h(n); admissible heuristic → optimal; h = 0 reduces to Dijkstra.\nLimitation: fails with negative edges; use Bellman-Ford or Johnson\'s algorithm (reweighting) for those cases.',
  },
  bellman_ford_algo: {
    summary: 'Bellman-Ford finds shortest paths with negative edge weights in O(VE) and detects negative-weight cycles.',
    explanation: 'Algorithm: relax all E edges V−1 times; after k iterations, dist[v] = shortest path using ≤ k edges.\nNegative cycle detection: if any edge still relaxes on the V-th iteration → negative cycle reachable from source.\nSPFA (Shortest Path Faster Algorithm): Bellman-Ford with queue—only enqueue vertices whose distance improved; O(kE) average.\nApplications: routing protocols (RIP uses Bellman-Ford distributed version), currency arbitrage detection, constraint graphs.\nComparison: Dijkstra O((V+E) log V) but no negative edges; BF O(VE) handles negative edges.\nJohnson\'s algorithm: reweight with BF → run Dijkstra from every vertex → O(V² log V + VE) for APSP on sparse graphs.',
  },
  prim_kruskal_mst: {
    summary: 'Prim\'s and Kruskal\'s algorithms find the minimum spanning tree of a weighted undirected graph using greedy strategies.',
    explanation: 'MST property: for any cut (S, V−S), the minimum-weight crossing edge belongs to some MST (cut property).\nKruskal: sort edges by weight O(E log E); add edge if it doesn\'t form cycle (union-find check O(α(V))); total O(E log E).\nPrim: grow tree from source; pick minimum-weight edge crossing cut; priority queue O(E log V).\nBoth produce same weight MST (may differ in structure if equal-weight edges).\nApplications: network design, cluster analysis, approximation algorithms (metric TSP: MST weight ≤ OPT).\nBorůvka\'s algorithm: O(E log V), parallel-friendly—each component picks its cheapest outgoing edge simultaneously.',
  },
  topological_sorting: {
    summary: 'Topological sort produces a linear ordering of a DAG\'s vertices where every directed edge u→v has u before v.',
    explanation: 'DFS-based: run DFS; output vertices in reverse finishing-time order → topological order.\nKahn\'s algorithm (BFS): repeatedly remove vertices with in-degree 0; O(V+E); also detects cycles (remaining vertices).\nApplications: build systems (make, Bazel), package dependency resolution, task scheduling, course prerequisites.\nTopological order is unique iff the DAG has a Hamiltonian path (exactly one ordering).\nParallel task scheduling: levels in topological order → tasks at same level can execute concurrently.\nLongest path in DAG (critical path method): O(V+E) via dynamic programming on topological order.',
  },
  kmp_string_matching: {
    summary: 'KMP (Knuth-Morris-Pratt) searches for a pattern in text in O(n+m) by using a failure function to avoid redundant comparisons.',
    explanation: 'Failure function π[i] = length of longest proper prefix of pattern[0..i] that is also a suffix.\nSearch: mismatch at position j → jump to pattern[π[j-1]] without re-examining text characters.\nPreprocessing: build π in O(m) using two-pointer technique.\nKMP never backtracks in the text—O(n) text traversal guaranteed regardless of pattern structure.\nZ-algorithm: alternative—computes Z[i] = length of longest prefix of string matching s[i..]; O(n+m); simpler than KMP.\nRabin-Karp: rolling hash O(n+m) expected, O(nm) worst; good for multi-pattern search (compare multiple hashes at once).',
  },
  segment_tree_algo: {
    summary: 'Segment trees support range queries (sum, min, max) and point/range updates in O(log n) using a binary tree over array intervals.',
    explanation: 'Build: O(n); each node stores aggregate of its interval; root covers [0,n-1].\nQuery [l,r]: recursively combine O(log n) nodes that partition the range.\nPoint update: update leaf, propagate up O(log n).\nLazy propagation: defer range updates using lazy[] array; push down on traversal → range update O(log n).\nPersistent segment tree: create new root per update, share unchanged nodes → O(log n) per version, O(n log n) space.\nHeavy-light decomposition: decompose tree into chains, each covered by segment tree → path queries in O(log² n).',
  },
  fenwick_tree_bit: {
    summary: 'Fenwick Tree (Binary Indexed Tree) supports prefix sum queries and point updates in O(log n) with O(n) space and simple implementation.',
    explanation: 'Key insight: bit.tree[i] stores sum of elements [i − lowbit(i) + 1 .. i] where lowbit(i) = i & (−i).\nPrefix sum query(i): sum = 0; while i>0: sum += bit[i]; i -= i & (−i) → O(log n).\nUpdate(i, delta): while i ≤ n: bit[i] += delta; i += i & (−i) → O(log n).\nSimpler code than segment tree; lower constant factor; limited to associative invertible operations (no range max).\n2D BIT: prefix sum of 2D matrix; nested loops with O(log² n) per operation.\nOrder-statistic: dynamic rank/select in O(log n) by treating array as frequency count.',
  },
  union_find_dsu: {
    summary: 'Union-Find (Disjoint Set Union) tracks connected components with near-O(1) amortized union and find operations using path compression and union by rank.',
    explanation: 'Find(x): follow parent pointers to root; path compression: make all nodes on path point directly to root.\nUnion(x,y): link roots; union by rank (or size): attach smaller tree under taller to keep height bounded.\nComplexity: O(α(n)) amortized per operation (α = inverse Ackermann, ≤ 4 for any practical n).\nKruskal\'s MST: check if edge creates cycle via find(u) ≠ find(v) → union; total O(E log E + E·α(V)).\nDynamic connectivity: offline link-cut trees; online with Union-Find (no delete support).\nApplications: Kruskal MST, network connectivity queries, image segmentation, percolation simulation.',
  },
  a_star_pathfinding: {
    summary: 'A* finds the shortest path by combining Dijkstra\'s cost-so-far with a heuristic estimate of remaining distance, focusing search toward the goal.',
    explanation: 'f(n) = g(n) + h(n): g = actual cost from start; h = heuristic estimate to goal.\nAdmissibility: h(n) ≤ h*(n) (never overestimate) → A* finds optimal path.\nConsistency (monotonicity): h(n) ≤ c(n,n\') + h(n\'); ensures each node expanded only once.\nWorst-case O(b^d) where b=branching factor, d=solution depth; outperforms Dijkstra in practice for geometric problems.\nHeuristics: Euclidean distance (grid), Manhattan (4-connected grid), Haversine (geographic).\nVariants: IDA* (memory-efficient DFS with f-bound), SMA* (bounded memory), Theta* (any-angle paths).',
  },
  floyd_warshall: {
    summary: 'Floyd-Warshall finds all-pairs shortest paths in O(V³) using dynamic programming, handling negative edges and detecting negative cycles.',
    explanation: 'DP recurrence: dist[i][j][k] = min(dist[i][j][k-1], dist[i][k][k-1] + dist[k][j][k-1]).\nIntermediate vertex optimization: only need 2D array; dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]) for each k.\nNegative cycle detection: if dist[i][i] < 0 after algorithm → negative cycle through i.\nPath reconstruction: maintain next[][] matrix; path i→j = i → next[i][j] → ... → j.\nTransitive closure: replace with boolean OR; O(V³) but very cache-friendly.\nApplications: router distance tables, social network degrees of separation, min-bottleneck path (replace + with max, min with min).',
  },
  max_flow_network: {
    summary: 'Maximum flow algorithms find the maximum amount of flow from source to sink in a network; max-flow equals min-cut by the Max-Flow Min-Cut theorem.',
    explanation: 'Ford-Fulkerson: repeatedly find augmenting path in residual graph (DFS), augment by bottleneck capacity → O(E·max_flow).\nEdmonds-Karp: BFS for shortest augmenting path → O(VE²); polynomial regardless of edge capacities.\nDinic\'s algorithm: blocking flows via level graph (BFS layering) → O(V²E); unit-capacity O(E√V).\nResidual graph: each edge u→v with capacity c and flow f creates forward edge (c-f) and backward edge (f).\nMax-Flow Min-Cut: value of max flow = capacity of min cut (separating s and t with minimum capacity).\nApplications: bipartite matching (O(E√V) via Hopcroft-Karp), image segmentation (graph cuts), airline scheduling.',
  },
  convex_hull_algorithm: {
    summary: 'The convex hull is the smallest convex polygon containing all points; several algorithms find it in O(n log n) or O(nh) time.',
    explanation: 'Graham scan: find lowest-y point as anchor; sort by polar angle O(n log n); process with stack maintaining CCW turns.\nAndrew\'s monotone chain: sort by x then y; build upper and lower hulls separately; simpler to implement.\nJarvis march (gift wrapping): start from leftmost, pivot to most counterclockwise point; O(nh) where h = hull size.\nChan\'s algorithm: O(n log h) by guessing h with exponential search; combines Graham + Jarvis.\nApplications: collision detection, diameter of point set, rotating calipers (min-bounding box), GIS.\n3D convex hull: QuickHull O(n log n) expected; gift-wrapping O(nF) where F = faces.',
  },
  amortized_analysis: {
    summary: 'Amortized analysis gives the average cost per operation over a sequence, smoothing occasional expensive operations across many cheap ones.',
    explanation: 'Aggregate method: total cost of n operations / n = amortized cost per operation.\nAccounting method: assign "credits" to cheap operations; spend credits on expensive; credit never goes negative.\nPotential method: Φ(D_i) = potential of data structure state; amortized cost = actual + ΔΦ; telescope to get total.\nDynamic array doubling: occasional O(n) copy amortized to O(1) per append; Φ = 2×(size - capacity/2).\nSplay tree: self-adjusting BST; O(log n) amortized via potential = Σ log(subtree size); accessed nodes move to root.\nBinomial heap: decrease-key and delete O(log n) amortized; used in optimal Dijkstra implementations.',
  },
  trie_data_structure: {
    summary: 'A trie (prefix tree) stores strings character by character, enabling O(m) insert/search/delete for a string of length m.',
    explanation: 'Structure: root represents empty string; each edge labeled with character; nodes mark end-of-word.\nInsert/search/delete: traverse character by character, O(m) regardless of number of strings.\nCompressed trie (Patricia/Radix tree): collapse chains of single-child nodes; O(m) ops with lower space constant.\nAC automaton (Aho-Corasick): trie + failure links (like KMP); multi-pattern matching in O(n + Σ|patterns| + matches).\nApplications: autocomplete, spell check, IP routing (prefix match), dictionary, lexicographic sorting.\nSpace: O(ALPHABET×nodes) worst case; more efficient with hash-children or compressed representation.',
  },
  bloom_filter: {
    summary: 'A Bloom filter is a space-efficient probabilistic set that supports membership queries with tunable false positive rate but no false negatives.',
    explanation: 'Structure: m-bit array initialized to 0; k hash functions; insert x: set k bits; query x: check all k bits.\nFalse positive probability: p ≈ (1 − e^{−kn/m})^k where n = inserted elements.\nOptimal k = (m/n) ln 2; optimal m = −n ln p / (ln 2)².\nNo false negatives: if all k bits set for x, x might not be in set (FP) but if any bit 0, x definitely absent.\nCounting Bloom filter: replace bits with counters → supports deletion at 3-4× space cost.\nApplications: CDN cache (skip disk lookup for cache miss), database query optimization (existence check), Bitcoin SPV wallets, join filtering.',
  },
  consistent_hashing: {
    summary: 'Consistent hashing maps both keys and nodes to a circular ring, so adding/removing a node only redistributes adjacent keys rather than all keys.',
    explanation: 'Ring: hash space [0, 2³²); each node hashed to position; each key assigned to first node clockwise (its successor).\nAdding node N: only keys between N\'s predecessor and N are remapped to N—O(K/n) keys move for K total keys, n nodes.\nRemoving node N: its keys redistribute to N\'s successor—again O(K/n) remapping.\nVirtual nodes (vnodes): each physical node has V virtual positions on ring; improves load balance; V=150 typical.\nUsed in: Cassandra, DynamoDB, Memcached (ketama), CDN routing.\nHotspot mitigation: vnodes + weight-based virtual node count proportional to server capacity.',
  },

  // ── COMPILERS ──────────────────────────────────────────────────
  lexer_tokenizer: {
    summary: 'A lexer (tokenizer) converts a character stream into a token stream using regular expressions compiled to deterministic finite automata.',
    explanation: 'Stages: define token patterns as regex → build NFA (Thompson\'s construction) → convert to DFA (subset construction) → minimize DFA (Hopcroft).\nLongest match rule: lexer greedily matches the longest possible token; keyword vs identifier disambiguation via priority.\nMaximal munch: consume as many characters as possible before producing a token.\nError recovery: skip character and continue; report line/column for diagnostics.\nLexer generators: flex (C), ANTLR (Java/Python), logos (Rust)—eliminate manual automaton coding.\nSymbol table: lexer populates identifier entries; enables keyword detection and scope analysis in later phases.',
  },
  context_free_grammar: {
    summary: 'Context-free grammars (CFG) describe programming language syntax; parsers transform token streams into parse trees using LL or LR parsing.',
    explanation: 'CFG: productions A → α; terminals (tokens), non-terminals (syntactic categories).\nLL(k) top-down: expand leftmost non-terminal using k tokens of lookahead; LL(1) for most practical grammars; recursive descent.\nLR(k) bottom-up: shift tokens onto stack, reduce by production when recognized; handles more grammars than LL.\nLALR(1): merged LR(1) states; used by yacc/bison, Java parser; most common production parser.\nAmbiguous grammar: multiple parse trees for same string—resolved via precedence/associativity rules.\nEarley parser: O(n³) for any CFG; GLR parser for ambiguous grammars; PEG (parsing expression grammars) for deterministic parsing.',
  },
  abstract_syntax_tree: {
    summary: 'The AST is a tree representation of program structure with syntactic sugar removed, used for semantic analysis and code generation.',
    explanation: 'Differs from CST (concrete syntax tree): AST omits parentheses, semicolons, and other syntactic scaffolding.\nNode types: BinaryOp, IfStmt, FuncDef, Block, Literal, Identifier—each with typed child slots.\nAST construction: parser directly builds AST via action rules in grammar; or builds CST and transforms.\nVisitor pattern: traverse AST with a visitor object—type checker, optimizer, and code generator are visitors.\nTransformations: desugaring (for → while), alpha-renaming, constant folding, inlining done on AST level.\nLanguage servers: clangd, rust-analyzer maintain AST for IDE features (go-to-def, refactoring, hover docs).',
  },
  semantic_analysis_compiler: {
    summary: 'Semantic analysis verifies type correctness, resolves names to their declarations, and catches errors that syntax analysis cannot detect.',
    explanation: 'Symbol table: hierarchical map from identifier → declaration (type, scope, storage class); pushed/popped on scope entry/exit.\nName resolution: bind each identifier use to its declaration; report undeclared, shadowed, or multiply-declared names.\nType checking: infer or verify type of every expression; subtyping rules, coercion rules, overload resolution.\nType inference: Hindley-Milner algorithm W generates type constraints and solves via unification O(n α(n)).\nError examples: type mismatch, void expression used as value, unreachable code, use of uninitialized variable.\nAttribute grammar: annotate AST with semantic attributes (types, values) using synthesized/inherited rules.',
  },
  ssa_compiler_form: {
    summary: 'Static Single Assignment form assigns each variable exactly once, making data-flow relationships explicit and simplifying compiler optimizations.',
    explanation: 'SSA property: every variable has exactly one definition in the program text; uses subscripts for versions (x₁, x₂).\nφ-functions at join points: x₃ = φ(x₁, x₂) selects the version from whichever predecessor was executed.\nConstruction: compute dominance tree and dominance frontiers; insert φ-functions; rename variables.\nBenefits: def-use chains are trivially explicit (one definition per name); enables copy propagation, dead code elimination, LICM, GVN.\nSSA used in: LLVM IR (all modern compilers), GCC GIMPLE, Java HotSpot C2, V8 TurboFan.\nDe-SSA: insert parallel copies at φ-function points; resolve via sequentialization to handle swap scenarios.',
  },
  register_allocation: {
    summary: 'Register allocation maps unlimited virtual registers (IR variables) to a finite set of physical CPU registers, spilling excess to the stack.',
    explanation: 'Graph coloring: interference graph—edge between variables that are simultaneously live; k-coloring for k physical registers.\nChaitin-Briggs: simplify (remove low-degree nodes), spill candidate if needed, rebuild and color; actual spills insert loads/stores.\nCoalescing: merge variables connected by copy instructions to eliminate moves; conservative coalescing avoids creating uncolorable graph.\nLinear scan: scan live intervals in order; assign first available register; evict interval with furthest end on spill—O(n log n).\nSSA-based: SSA simplifies liveness analysis (each name single-assignment) → used in LLVM.\nSpill cost heuristics: minimize spills of hot variables (high loop depth, many uses); guided by profiling.',
  },
  garbage_collection_types: {
    summary: 'Garbage collectors automatically reclaim unused memory; major algorithms include mark-and-sweep, reference counting, and generational collection.',
    explanation: 'Mark-and-sweep: trace from roots (globals, stack), mark reachable, sweep unmarked—stop-the-world pause.\nTri-color marking: white (unseen), grey (seen but children not processed), black (fully processed)—enables incremental/concurrent GC.\nReference counting: increment on alias, decrement on death; immediate reclamation; cycles require cycle detector (CPython).\nCopying GC: scan live objects, copy to new space compactly—eliminates fragmentation; bad for large heaps (copy cost).\nGenerational: young generation (most objects die young) collected frequently with cheap minor GC; old gen with major GC.\nModern: ZGC/Shenandoah (concurrent, <1ms pauses); G1 (region-based, predictable pause target); Go GC (concurrent tricolor).',
  },
  jit_compilation: {
    summary: 'JIT (Just-In-Time) compilers translate bytecode or IR to native machine code at runtime, guided by profiling to focus effort on hot code paths.',
    explanation: 'Profiling: method invocation counts, loop iteration counts, type feedback for virtual dispatch; cheap interpreter counters.\nTiered compilation: JVM—C1 (client, fast compile) → C2 (server, heavy optimize) triggered by thresholds; similar in V8 (Ignition→Turbofan).\nSpeculative optimization: assume monomorphic call site → inline; guard + deoptimize on violation (bailout to interpreter).\nKey optimizations: method inlining (eliminates dispatch overhead), escape analysis (stack allocate non-escaping objects), loop unrolling.\nTrace JIT: record hot paths (traces) and compile straight-line sequences; used in LuaJIT, early Firefox JS.\nLLVM ORC (On-Request Compilation): lazy compilation on first call; used in Julia, Swift, Clang JIT.',
  },
  type_system_programming: {
    summary: 'Type systems classify program values into types, enabling static detection of errors and guiding compiler optimizations.',
    explanation: 'Soundness: well-typed programs don\'t go wrong at runtime ("progress + preservation" theorems).\nNominative vs structural typing: Java (nominal: must explicitly implement interface) vs TypeScript/Go (structural: shape compatibility).\nSubtyping (LSP): if S <: T, S usable wherever T expected; function args contravariant, return type covariant.\nParametric polymorphism (generics): Java type erasure → single runtime class; C++/Rust monomorphization → separate code per type.\nGradual typing: mix static (annotated) and dynamic (unannotated) regions; TypeScript, mypy, Typed Racket.\nDependent types: types parameterized by values (Vec n α, a list of exactly n elements); Coq, Lean, Agda.',
  },
  llvm_compiler_infra: {
    summary: 'LLVM is a modular compiler framework centered on a typed SSA IR that enables rich analyses and code generation for multiple targets.',
    explanation: 'Three-phase: frontend (Clang generates LLVM IR) → middle-end (target-independent optimization passes) → backend (target-specific code generation).\nLLVM IR: strongly-typed SSA form; infinite virtual registers; typed instructions (add i32, fadd float); modules, functions, BBs.\nPass pipeline: manager runs analysis passes (dominators, alias analysis) and transformation passes (mem2reg, instcombine, GVN, LICM, vectorize).\nBackend: Instruction Selection (SelectionDAG), register allocation (linear scan or greedy), instruction scheduling, frame lowering.\nTarget variety: x86, ARM, RISC-V, WASM, NVPTX (GPU), AMDGPU; enables cross-compilation.\nLanguages using LLVM: Clang (C/C++), Rust, Swift, Julia, Kotlin Native, Zig, Crystal.',
  },
  loop_optimizations: {
    summary: 'Loop optimizations improve performance by reducing overhead, exploiting parallelism, and improving cache utilization in the most time-critical code.',
    explanation: 'LICM (Loop Invariant Code Motion): hoist invariant computations (those not dependent on loop variable) to loop preheader.\nInduction variable strength reduction: replace multiply by loop index with cheaper add (s = s + step on each iteration).\nLoop unrolling: replicate loop body k times, reduce by k; fewer branches; more instruction-level parallelism and vectorization opportunities.\nLoop fusion: combine adjacent loops with same bounds to improve data locality (fewer array traversals).\nLoop tiling (blocking): reorder iterations to fit data in cache; polyhedral model (Pluto) automates this for affine loops.\nVectorization (auto-vectorization): compiler converts scalar loop to SIMD; requires no data dependences (aliasing kills vectorization).',
  },
  memory_model_pl: {
    summary: 'A memory model defines the ordering guarantees for memory accesses visible between threads, specifying when stores become visible to other threads.',
    explanation: 'Sequential consistency (SC): total order of all operations across all threads; intuitive but expensive—prevents most hardware/compiler reorderings.\nC++ memory_order: relaxed (no sync), acquire (see all stores before counterpart release), release, acq_rel, seq_cst.\nJava memory model (JMM): happens-before relation; volatile provides seq_cst; synchronized provides acquire-release.\nStore buffer (x86 TSO): stores buffered locally → loads can see old value of another processor\'s store (store-load reorder).\nData race = undefined behavior (C++): two accesses to same location, ≥1 write, no synchronization between them.\nPractice: use std::atomic with appropriate memory_order; avoid relaxed except in well-understood performance-critical cases.',
  },
  instruction_scheduling: {
    summary: 'Instruction scheduling reorders instructions within a basic block to hide latency and maximize functional unit utilization without changing semantics.',
    explanation: 'Dependence graph: RAW (true), WAR (anti), WAW (output) dependencies define ordering constraints.\nList scheduling (topological): sort by priority heuristic (critical path length, resource pressure); greedy assignment to cycles.\nSoftware pipelining (modulo scheduling): overlap loop iterations by issuing operations from multiple iterations simultaneously.\nInitiation interval (II): minimum cycles per loop iteration; II ≥ max(resource_bound, recurrence_bound).\nOut-of-order CPU: hardware scheduling at runtime (dynamic); static scheduling still helps (reduces scheduler pressure, improves code size).\nSuperblock scheduling: trace (likely path) optimized ignoring branches off-trace; hyperblock handles multiple entries.',
  },

  // ── COMPUTER ARCHITECTURE ADVANCED ────────────────────────────
  branch_predictor_micro: {
    summary: 'Branch predictors speculatively determine which path a branch will take, enabling the CPU to fetch and execute instructions before the branch resolves.',
    explanation: 'Bimodal predictor: 2-bit saturating counter per PC (strongly/weakly taken/not-taken); good for regular patterns.\nGshare: XOR PC with global history register → index into prediction table; captures correlations between branches.\nTAGE (Tagged Geometric History Lengths): multiple banks with different history lengths; matching tagged entry with longest history wins; state-of-art (>97% accuracy).\nTournament predictor: meta-predictor selects between global (gshare) and local (per-PC history) predictors—used in Alpha 21264.\nBTB (Branch Target Buffer): caches predicted target address; enables fetch to continue before decode.\nMisprediction penalty: 15-20 cycles on modern CPUs; drives significant investment in predictor complexity.',
  },
  memory_ordering_arch: {
    summary: 'Memory ordering determines when stores become visible to other processors; most CPUs relax ordering for performance, requiring explicit barriers.',
    explanation: 'x86 TSO (Total Store Order): only store-load reordering allowed (store buffer); SFENCE/LFENCE/MFENCE insert full barriers.\nARM: very relaxed model; almost any reordering possible; DMB (data memory barrier) and DSB instructions for ordering.\nReordering types: store-store, load-load, load-store, store-load—each architecture allows different subsets.\nAcquire (load with barrier): see all stores before corresponding release; prevents load moving before acquire.\nRelease (store with barrier): all preceding stores visible before this store; prevents store moving after release.\nC++ memory_order_acquire/release pair provides sufficient sync for producer-consumer without seq_cst overhead.',
  },
  simd_vectorization: {
    summary: 'SIMD (Single Instruction Multiple Data) instructions process multiple data elements simultaneously using wide registers, greatly accelerating data-parallel workloads.',
    explanation: 'ISA evolution: MMX (64-bit) → SSE (128-bit, 4×float or 2×double) → AVX (256-bit, 8×float) → AVX-512 (512-bit, 16×float).\nThroughput: 8×float AVX FMA = 16 FLOPs/cycle; AMD Zen4 AVX-512 = 32 FLOPs/cycle per core.\nAuto-vectorization: compiler converts scalar loop to SIMD when no aliasing, no function calls, reduction patterns recognized.\nGather/scatter: load/store non-contiguous data (AVX2 _mm256_i32gather); latency ~10× vs contiguous—avoid in inner loops.\nMask operations: predicated execution via mask registers (AVX-512); enables vectorization of conditional branches.\nFMA (Fused Multiply-Add): a*b+c in one instruction with single rounding; key for BLAS, FFT, DNN performance.',
  },
  gpu_compute_arch: {
    summary: 'GPUs achieve massive throughput via thousands of cores grouped into streaming multiprocessors that execute warps of 32 threads in lockstep (SIMT).',
    explanation: 'SM (Streaming Multiprocessor): 128 CUDA cores (FP32), 4 warp schedulers, 64-256KB L1/shared memory per SM; ~100 SMs on high-end GPU.\nWarp (32 threads): execute same instruction; divergence (branches) causes threads to be masked → efficiency loss.\nOccupancy: active warps / max warps per SM; higher occupancy hides latency via warp switching.\nMemory hierarchy: registers (fastest, 32KB/warp) → shared memory (manual cache, ~100 cycles) → L2 (300 cycles) → HBM (600+ cycles).\nCoalescing: threads in warp access consecutive addresses → single memory transaction; random access → 32 transactions.\nStream and tensor cores: hardware matrix multiply units (A100: 312 TFLOPS TF32, 624 TFLOPS FP16 with sparsity).',
  },
  chiplet_packaging: {
    summary: 'Chiplet design disaggregates a large SoC into smaller dies connected via high-density interconnects, improving yield and enabling heterogeneous integration.',
    explanation: 'Motivation: large monolithic die has low yield (defect probability ∝ area); smaller dies (chiplets) have better yield.\nInterconnect: UCIe (Universal Chiplet Interconnect Express) standard; EMIB (Intel embedded multi-die bridge); Co-Wos (TSMC).\n2.5D: chiplets mounted on silicon interposer (HBM stacks + GPU die on CoWoS)—high bandwidth, short traces.\n3D stacking (SoIC, X-Cube): dies stacked vertically via TSV; extreme bandwidth, higher thermal challenges.\nExamples: AMD EPYC Genoa—up to 12 compute chiplets + I/O die; Intel Ponte Vecchio—47 tiles.\nDesign challenges: die-to-die timing closure, thermal management across chiplets, test at chiplet level before assembly.',
  },
  spectre_vulnerability: {
    summary: 'Spectre exploits speculative execution to leak cross-privilege-boundary data through cache timing side channels, affecting virtually all modern CPUs.',
    explanation: 'Attack: (1) mistrain branch predictor; (2) speculatively access secret data across boundary; (3) encode secret in cache state via array access; (4) measure cache hit/miss timing (Flush+Reload: 100 vs 300 cycles).\nVariants: Spectre v1 (bounds check bypass), v2 (BTB injection), Spectre-RSB (return stack), MDS (microarchitectural data sampling).\nMitigations: retpoline (replace indirect branches with infinite loop trick), IBPB (indirect branch prediction barrier), site isolation in browsers, LFENCE after branch.\nKernel mitigations: KPTI (kernel page-table isolation) for Meltdown; prevents kernel mapping in user page table.\nPerformance impact: 5-30% for database/I/O-heavy workloads; minimal for compute-bound.\nRoot cause: performance optimization (speculation) conflicts with security boundary assumption.',
  },
  numa_memory_arch: {
    summary: 'NUMA (Non-Uniform Memory Access) systems have memory attached to each CPU socket, giving faster access to local memory than remote memory.',
    explanation: 'Topology: 2-8 NUMA nodes (sockets) connected via QPI/UPI (Intel) or Infinity Fabric (AMD); remote memory 1.5-3× slower.\nNUMA-aware allocation: allocate memory on node where thread runs (default first-touch policy in Linux).\nnumactl: bind process to specific nodes (--cpunodebind 0 --membind 0); avoid cross-NUMA traffic.\nLinux NUMA balancing: kernel periodically faults pages to detect access pattern; migrates pages to accessing node.\nFalse sharing across NUMA: far worse than within socket; separate data structures by NUMA domain.\nProfiling: perf stat -e node-load-misses shows remote NUMA accesses; numastat shows per-node memory usage.',
  },
  hbm_memory_tech: {
    summary: 'High Bandwidth Memory (HBM) stacks multiple DRAM dies connected by TSVs, delivering 2-3 TB/s bandwidth on GPU and HPC accelerators.',
    explanation: 'Architecture: 4-12 DRAM dies stacked vertically; dies connected by TSV (Through-Silicon Via) with ~1000 I/O pins per stack vs ~32 for DDR5.\nHBM3: 819 GB/s per stack; AMD MI300 (8 stacks) → 5.2 TB/s; NVIDIA H100 (6 stacks HBM3) → 3.35 TB/s.\nBandwidth vs capacity: HBM prioritizes bandwidth (short, wide bus) over capacity; typical 16-96 GB per accelerator.\nPower: HBM uses 30-50% less power than GDDR5 at equivalent bandwidth due to shorter, slower links.\nPackaging: GPU die + HBM stacks on silicon interposer (CoWoS, EMIB); 2.5D integration required.\nAlternatives: GDDR6X (mobile GPU/gaming), LPDDR5 (mobile), HBM-PIM (processing-in-memory emerging).',
  },
  interconnect_pcie: {
    summary: 'PCIe is the dominant point-to-point serial interconnect for CPUs to communicate with GPUs, NVMe SSDs, and other high-speed peripherals.',
    explanation: 'Protocol: link-layer (TLP packets, credit-based flow control), transaction-layer (memory read/write, I/O, message).\nBandwidth: PCIe 4.0 16GT/s per lane; x16 link = 32 GB/s (64 GB/s bidirectional); PCIe 5.0: 64 GB/s; PCIe 6.0 PAM4: 128 GB/s.\nIOMMU: maps device DMA to virtual address space; prevents DMA attacks; enables SR-IOV VF isolation.\nNVMe over PCIe: eliminates SATA overhead; NVMe SSD latency <100μs; queue depth 64K vs SATA\'s 32.\nCXL (Compute Express Link): PCIe 5.0 physical + CXL protocol; cache-coherent (load/store to device memory); enables CPU←→GPU←→memory pooling.\nMulti-GPU: NVIDIA NVLink (bidirectional 900 GB/s) or AMD Infinity Fabric for GPU-GPU direct transfer bypassing CPU.',
  },
  tpu_architecture: {
    summary: 'Google\'s TPU is an ASIC optimized for DNN inference and training using a 256×256 systolic array for high-throughput matrix multiplication.',
    explanation: 'TPUv1 (inference): 256×256 MAC systolic array; 8-bit quantized multiply-accumulate; 92 TOPS; 65,536 MACs active per cycle.\nTPUv4 (training): 275 TFLOPS BF16 per chip; 1.1 PB/s HBM bandwidth (HBM2e); 4096-chip pods via custom 3D optical circuit switching.\nXLA (Accelerated Linear Algebra): compiler for TensorFlow/JAX; fuses ops, tiles computation, manages VMEM (on-chip SRAM).\nBF16 (Brain Float 16): 8-bit exponent (same as FP32) + 7-bit mantissa; better dynamic range than FP16; same range as FP32.\nSPMD programming: tf.distribute.MirroredStrategy; each TPU core processes shard of batch; all-reduce for gradient sync.\nTCO efficiency: TPUv4 uses 56% less energy than equivalent GPU setup for transformer training (Google claim).',
  },
  compute_in_memory: {
    summary: 'Compute-In-Memory (CIM) performs computations inside memory arrays to eliminate the von Neumann bottleneck of moving data between processor and memory.',
    explanation: 'Motivation: memory bandwidth saturates before compute for data-intensive ops (GEMV, element-wise ops); moving data ≫ computing energy.\nAnalog CIM: resistive crossbar (PCM, RRAM, or SRAM cells) computes V=IR; row voltages × conductance matrix = column currents (MAC in O(1)).\nDigital CIM: SRAM cells augmented with local logic; bitwise operations or digital MAC within array.\nAccuracy: analog CIM suffers from device variation, noise, limited precision (4-8 bits); digital CIM is exact.\nExamples: IBM PCM CIM (DNN inference), Mythic AI (flash CIM), TSMC iCIM, Samsung HBM-PIM.\nChallenge: programming model (must express ops as matrix ops); ADC overhead; thermal variation; limited write endurance.',
  },

  // ── SOFTWARE ENGINEERING ───────────────────────────────────────
  design_patterns_gof: {
    summary: 'The Gang-of-Four\'s 23 design patterns provide reusable solutions to recurring object-oriented design problems in three categories: creational, structural, and behavioral.',
    explanation: 'Creational: Singleton (one instance), Factory Method (create via subclass), Abstract Factory (family of objects), Builder (step-by-step construction), Prototype (clone).\nStructural: Adapter (interface bridge), Decorator (wrap to add behavior), Facade (simple interface to subsystem), Proxy (control access), Composite (tree of uniform objects).\nBehavioral: Observer (event pub/sub), Strategy (swappable algorithm), Command (encapsulate action), Iterator (sequential access), Template Method (skeleton with hooks).\nTrade-offs: patterns add indirection; overuse = unnecessary complexity; use when solving the specific problem they address.\nLanguage built-ins replace some patterns: Python iterators = Iterator, Java Streams = Pipeline, first-class functions = Strategy.',
  },
  solid_principles: {
    summary: 'SOLID is a set of five object-oriented design principles that guide creation of maintainable, extensible, and testable code.',
    explanation: 'S — Single Responsibility: class has one reason to change; separate business logic from persistence, validation, formatting.\nO — Open/Closed: open for extension (subclass, plugin), closed for modification (existing code unchanged); use interfaces + strategy.\nL — Liskov Substitution: subtype must honor contracts of base type; no strengthening preconditions, no weakening postconditions.\nI — Interface Segregation: prefer narrow specific interfaces over fat generic ones; clients don\'t implement methods they don\'t use.\nD — Dependency Inversion: depend on abstractions (interfaces), not concretions; inject dependencies rather than constructing them.\nViolations: god class (breaks S), if-chain on type (breaks O), type cast to subtype (breaks L), large interface (breaks I), new inside class (breaks D).',
  },
  ci_cd_pipeline: {
    summary: 'CI/CD automates building, testing, and deploying software to enable rapid, reliable releases through a pipeline of automated gates.',
    explanation: 'Continuous Integration: every commit triggers build + unit tests + lint; fast feedback (<10 min); main branch always deployable.\nContinuous Delivery: every green build deployable to staging; deploy to production manually or on approval.\nContinuous Deployment: automated production deploy on every green commit; requires high test coverage and observability.\nPipeline stages: compile → unit test → integration test → security scan (SAST, DAST) → staging deploy → smoke test → production.\nTools: GitHub Actions, GitLab CI, Jenkins, CircleCI, ArgoCD (GitOps CD).\nFeature flags: decouple deploy from release; dark launch to subset; kill switch for problematic features.',
  },
  test_driven_development: {
    summary: 'TDD is a development practice where tests are written before production code, driving design through the Red-Green-Refactor cycle.',
    explanation: 'Red: write a failing test that expresses desired behavior; test must fail (proves test actually tests something).\nGreen: write minimal code to make the test pass—no extras; resist over-engineering at this stage.\nRefactor: improve code quality (name, structure, deduplication) while keeping tests green; safety net enables confident refactoring.\nTest pyramid: many unit tests (fast, isolated), fewer integration tests, few E2E tests (slow, brittle).\nBenefits: design pressure (hard-to-test code = bad design), instant regression detection, living documentation.\nMutation testing: inject artificial bugs; if tests don\'t catch → tests are weak; tools: PIT (Java), mutmut (Python).',
  },
  event_sourcing: {
    summary: 'Event Sourcing persists application state as a sequence of immutable domain events rather than current state, enabling temporal queries and event-driven integration.',
    explanation: 'Core idea: events are the source of truth; current state = fold/replay of events since beginning.\nEvent store: append-only log (EventStoreDB, Kafka, PostgreSQL table); events immutable—never delete or modify.\nBenefits: complete audit log, temporal queries (state at any past time), easy event-driven integration (other services subscribe).\nEvent versioning: events must be schema-evolved carefully; use event upcasters or version fields.\nSnapshot optimization: periodically snapshot aggregate state to limit replay cost; resume from latest snapshot + subsequent events.\nCombined with CQRS: command side emits events → event handler updates read model (projections) → query side reads from read model.',
  },
  cqrs_pattern: {
    summary: 'CQRS (Command Query Responsibility Segregation) separates write operations (commands) from read operations (queries) into different models and potentially different stores.',
    explanation: 'Command: operation that changes state; returns void or command-specific result (not the new state); example: PlaceOrder, CancelPayment.\nQuery: read-only operation; returns DTO optimized for the view; never modifies state; can be denormalized.\nMotivation: read and write workloads often have different scalability/structure needs; combine write OLTP with read-optimized projections.\nEventual consistency: command updates write store → event triggers read model update → brief lag before query reflects change.\nComplexity cost: two models to maintain; increased operational complexity; only worthwhile with significant read/write asymmetry.\nPattern ecosystem: CQRS + Event Sourcing + DDD aggregates form cohesive architecture for complex domains.',
  },
  domain_driven_design: {
    summary: 'Domain-Driven Design (DDD) aligns software structure with business domain concepts through ubiquitous language and explicit bounded contexts.',
    explanation: 'Ubiquitous language: shared vocabulary between developers and domain experts used consistently in code and conversations.\nBounded Context: explicit boundary where a specific domain model applies; different contexts may use same term differently.\nAggregate: cluster of domain objects treated as a unit; one Root entity; transactions stay within aggregate boundary.\nValue Object: immutable, no identity (Money, DateRange); Entity: has identity that persists over time (Order, Customer).\nDomain events: something significant that happened (OrderPlaced, PaymentFailed); used for integration between bounded contexts.\nContext Map: diagram showing relationships (Partnership, Customer-Supplier, Conformist, Anti-Corruption Layer) between bounded contexts.',
  },
  software_metrics: {
    summary: 'Software quality metrics quantify code complexity, maintainability, and team delivery performance to guide engineering decisions.',
    explanation: 'Cyclomatic complexity: V(G) = E − N + 2P; number of independent paths; > 10 → refactor; measurable with SonarQube, radon.\nCode coverage: line (executed lines), branch (all conditional branches), mutation (artificial bug detection).\nTechnical debt: estimated cost to fix suboptimal code; SonarQube computes in developer-days.\nDORA metrics (DevOps Research & Assessment): deployment frequency, lead time for changes, change failure rate, mean time to restore.\nCode churn: files frequently changed correlate with defects; git log analysis identifies hot spots.\nInstability metric: I = Ce/(Ca+Ce); afferent (Ca) vs efferent (Ce) couplings; stable packages should have abstract components.',
  },
  dependency_injection: {
    summary: 'Dependency Injection (DI) is an IoC technique where objects receive their dependencies from outside rather than creating them, enabling loose coupling and testability.',
    explanation: 'Constructor injection (preferred): dependencies declared in constructor → compile-time-visible, immutable after construction.\nSetter injection: optional dependencies via setters; allows partial configuration; harder to detect missing deps.\nField injection: @Inject on field (Spring); convenient but hides dependencies, untestable without framework.\nDI container: Spring (Java), .NET DI, Dagger (Android), Guice; wires object graph at startup based on configuration.\nBenefits: swap implementations (real vs mock in test); single configuration of production vs test dependencies; explicit dependency graph.\nService locator anti-pattern: object asks container for dependencies at runtime → hidden dependencies, harder to test than DI.',
  },
  olap_vs_oltp: {
    summary: 'OLTP handles many small transactional workloads with low latency, while OLAP handles complex analytical queries over large datasets with high throughput.',
    explanation: 'OLTP (Online Transactional Processing): row-oriented, normalized schema, short read/write transactions, high concurrency (1000s TPS).\nOLAP (Online Analytical Processing): columnar storage, denormalized star/snowflake schema, long aggregation queries, batch-oriented.\nColumn stores: read only needed columns; compress well (same type per column: RLE, delta, dictionary encoding).\nStar schema: fact table (metrics) + dimension tables (time, product, customer); efficient for GROUP BY + filter queries.\nHTAP (Hybrid): single system for both (TiDB, SingleStore, MemSQL); avoids ETL pipeline; trades peak efficiency in each mode.\nTools: Snowflake, BigQuery, Redshift (OLAP); PostgreSQL, MySQL (OLTP); DuckDB (in-process OLAP).',
  },
  columnar_storage: {
    summary: 'Columnar storage organizes data by column rather than by row, enabling high compression ratios and vectorized execution for analytical queries.',
    explanation: 'Layout: all values of column C stored contiguously on disk; reads skip irrelevant columns (projection pushdown).\nCompression: same-type values compress well—RLE (run-length encoding) for low-cardinality, delta encoding for timestamps, dictionary for strings.\nZone maps (min/max per block): predicate pushdown skips entire blocks without decompressing; like bloom filter at block level.\nVectorized execution: process 8192 values per batch using SIMD; amortizes per-value interpretation overhead.\nParquet/ORC: standard columnar file formats; Parquet widely used in data lakes (Spark, Presto, Hive).\nClickHouse: 100B rows/s scan rate; Apache Arrow: in-memory columnar format for zero-copy inter-process communication.',
  },
  skip_list: {
    summary: 'A skip list is a probabilistic data structure with layered linked lists that achieves O(log n) search, insert, and delete expected time with simple implementation.',
    explanation: 'Structure: base list (level 0) + express lanes (levels 1..h); each node randomly promoted to higher levels with prob p (typically 0.5).\nSearch: start at top-left; move right if next < target, drop level otherwise; O(log n) expected levels traversed.\nInsert: search for position, coin-flip to determine height, splice into each level; O(log n) expected.\nLockfree skip list: compare-and-swap for concurrent insert/delete; used in Java ConcurrentSkipListMap.\nExpected space: O(n) total nodes (geometric series: n + n/2 + n/4 + ... = 2n).\nVs balanced BST: simpler implementation, similar asymptotic complexity, more amenable to concurrent access; used in Redis ZADD (sorted sets) and LevelDB memtable.',
  },
  count_min_sketch: {
    summary: 'Count-Min Sketch estimates element frequencies in a data stream using sub-linear space with probabilistic error guarantees.',
    explanation: 'Structure: d × w counter array; d independent hash functions; insert x: increment CMS[i][h_i(x)] for all i.\nPoint query: f̂(x) = min_i CMS[i][h_i(x)]; always ≥ true count (only over-estimates due to hash collisions).\nError guarantee: P[f̂(x) ≤ f(x) + ε·N] ≥ 1−δ with w = ⌈e/ε⌉ columns and d = ⌈ln(1/δ)⌉ rows.\nHeavy hitters: combine with min-heap to track top-k elements (top-k with CMS); stream mining.\nComparison: HyperLogLog counts distinct elements; CMS estimates frequencies; both are sketch structures.\nApplications: network traffic analysis (DDoS detection), search query frequency, recommendation system (hot item detection), database query optimization.',
  },
  api_versioning: {
    summary: 'API versioning strategies manage breaking changes in public APIs while maintaining backward compatibility for existing consumers.',
    explanation: 'URL versioning (/v1/users, /v2/users): most explicit; easy to route; clutters URL namespace; forces client changes.\nHeader versioning (Accept: application/vnd.api+json;version=2): cleaner URLs; less discoverable; harder to test in browser.\nQuery parameter (?version=2): simple; cacheable; often used for minor variations.\nSemantic versioning: MAJOR.MINOR.PATCH; MAJOR = breaking change; document deprecation policy (min 6 months).\nBackward-compatible changes (safe): add optional field, new endpoint, new enum value (clients ignore unknown).\nBreaking changes: remove field, change type, rename field, change semantics; require MAJOR bump or versioned endpoint.\nContract testing (Pact): consumer-driven contracts verify provider doesn\'t break consumer expectations.',
  },
  load_balancing_algo: {
    summary: 'Load balancers distribute incoming requests across backend servers to maximize throughput and minimize response time using various scheduling algorithms.',
    explanation: 'Round-robin: send requests sequentially to each server; simple, no state; poor when requests have variable cost.\nWeighted round-robin: assign proportional share based on server capacity; useful for heterogeneous backends.\nLeast connections: route to server with fewest active connections; better for variable request duration.\nIP hash: hash client IP → deterministic server selection; provides session affinity without sticky sessions.\nPower of two choices: pick 2 random servers, choose the one with fewer connections; near-optimal with O(1) overhead.\nLayer 7 LB (HTTP): content-based routing (by URL path, header); TLS termination; Nginx, HAProxy, AWS ALB.\nL4 LB (TCP): faster, no HTTP parsing; ECMP at network layer; AWS NLB, Google Maglev.',
  },
  service_discovery: {
    summary: 'Service discovery enables services in dynamic environments to find each other without hardcoded addresses by registering and querying a central registry.',
    explanation: 'Client-side discovery: service queries registry (Consul, Eureka) and performs load balancing itself; tight coupling to registry.\nServer-side discovery: load balancer queries registry; client oblivious; AWS ALB with ECS, Kubernetes kube-proxy.\nDNS-based: services registered as DNS SRV records; simple, platform-agnostic; TTL-based caching can cause stale entries.\nHealth checking: registry deregisters failing instances via TTL or active health probes; prevents routing to unhealthy nodes.\nService mesh (Istio, Linkerd): sidecar intercepts all traffic; control plane manages discovery + routing + mTLS transparently.\nKubernetes: CoreDNS provides DNS discovery; Service (ClusterIP) provides stable virtual IP with kube-proxy iptables/IPVS rules.',
  },
  containerization_docker: {
    summary: 'Containers use Linux namespaces and cgroups to provide isolated execution environments that share the host kernel, enabling consistent and portable deployments.',
    explanation: 'Namespaces: PID (isolated process tree), net (private network stack, IP), mnt (private filesystem view), uts (hostname), ipc, user (UID remapping).\ncgroups (control groups): limit CPU, memory, block I/O, network bandwidth per container; prevent noisy neighbor.\nUnion filesystem (OverlayFS): image = stack of read-only layers + thin read-write container layer; copy-on-write.\nImage build: each Dockerfile instruction creates layer; layers cached and shared across images; multi-stage reduces final image.\nOCI (Open Container Initiative): standardized runtime spec (runc) and image spec; decouples container runtime from orchestrator.\nSecurity: containers share host kernel—weaker isolation than VMs; privileged containers are effectively root on host.',
  },
  software_design_by_contract: {
    summary: 'Design by Contract formalizes software component obligations with preconditions (caller duty), postconditions (callee duty), and invariants (always-true conditions).',
    explanation: 'Precondition: must hold when method is called; caller\'s obligation; if violated → programming error in caller.\nPostcondition: guaranteed by method if precondition held; implementer\'s obligation; if violated → bug in method.\nClass invariant: property that holds before and after every public method; ensures object integrity at boundaries.\nBertrand Meyer coined term; built into Eiffel language; Java asserts, Python doctest, JML (Java Modeling Language).\nLiskov connection: subclass may weaken preconditions (accept more) and strengthen postconditions (guarantee more)—not vice versa.\nBenefits: clarify expectations, guide testing (precond defines valid inputs, postcond defines expected outputs), enable static verification.',
  },
  monorepo_polyrepo: {
    summary: 'Monorepos store all projects in a single repository while polyrepos use separate repositories per service; each approach has distinct scalability and tooling trade-offs.',
    explanation: 'Monorepo benefits: atomic cross-service commits, unified CI/CD, easy code sharing, no dependency versioning hell, global refactoring.\nMonorepo challenges: scale (Git slows with millions of files); mitigated by virtual filesystem (Scalar/VFS4Git), incremental builds (Bazel, Nx, Turborepo).\nPolyrepo benefits: independent versioning, clear ownership, smaller CI scope, enforced API boundaries.\nPolyrepo challenges: dependency update cascade, code duplication, harder cross-service refactoring, inconsistent tooling.\nOrganizations: Google, Facebook, Microsoft use monorepo; Netflix, Amazon use polyrepo (service teams autonomous).\nHybrid: "many repos" with selective federation; shared packages in private registry (npm, Maven); monorepo per domain/team.',
  },
  code_review_practices: {
    summary: 'Code review is a collaborative quality gate that catches bugs, enforces conventions, and shares knowledge; effective reviews are timely, constructive, and appropriately scoped.',
    explanation: 'PR size: < 400 LOC for optimal reviewability; large PRs → reviewers lose focus; break into logical commits.\nAutomation first: linting, formatting, type checking, unit tests must pass before human review; humans focus on logic and design.\nReviewer mindset: propose, don\'t mandate ("consider X" vs "do X"); ask questions to understand intent; approve small wins.\nConventional Commits: feat:, fix:, chore:, docs:, refactor: prefixes enable changelog generation and semantic versioning.\nChecklist: correctness, edge cases, error handling, performance implications, security (injection, auth), test coverage, naming.\nGolden rule: review code, not the author; comments are about the code; provide context with critique ("X is slow because Y; suggest Z").',
  },

  // ════ B11 ════


// ── Security ─────────────────────────────────────────────────

  buffer_overflow: {
    summary: 'Buffer overflow attacks overwrite adjacent memory (return address, function pointers) by writing beyond an allocated buffer boundary. Modern mitigations layer stack canaries, ASLR, NX/DEP, CFI, and hardware shadow stacks to defeat exploitation.',
    explanation: 'Stack-based overflow: write past a local buffer to overwrite the saved return address, redirecting execution to attacker shellcode.\n\nHeap-based overflow: overwrite heap metadata or adjacent objects (vtable pointers, function pointers) to achieve code execution.\n\nStack canary: a random value placed between locals and saved RIP; checked on function return — mismatch triggers abort (gcc -fstack-protector-strong).\n\nASLR (Address Space Layout Randomization): randomizes base addresses of stack, heap, and libraries each run; attacker must leak an address to defeat it.\n\nNX/DEP (No-Execute / Data Execution Prevention): marks stack and heap pages non-executable via hardware PTE bits; defeats simple shellcode injection.\n\nReturn-Oriented Programming (ROP): chains existing code gadgets (ret-ending instruction sequences) to build Turing-complete computation without injecting code, bypassing NX.\n\nControl Flow Integrity (CFI): restricts indirect call/jump targets to statically valid sites (compiler-enforced); Intel CET (Control-flow Enforcement Technology) uses a hardware shadow stack to verify return addresses.',
  },

  sql_injection: {
    summary: 'SQL injection inserts malicious SQL through unsanitized user input to manipulate or extract database content. It is historically the OWASP Top 1 vulnerability and is prevented by parameterized queries and ORMs.',
    explanation: 'Classic injection: input \' OR \'1\'=\'1 appended to a WHERE clause always evaluates true, dumping all rows.\n\nBlind boolean-based SQLi: no output returned; attacker infers data bit by bit via true/false response differences (e.g., AND SUBSTRING(password,1,1)=\'a\').\n\nTime-based blind SQLi: uses SLEEP(n) or WAITFOR DELAY to infer data when no visible difference exists in responses.\n\nError-based SQLi: provoke DB error messages that leak schema names, table names, and column types (extractvalue(), updatexml() in MySQL).\n\nSecond-order injection: malicious data stored safely, then later executed unsafely in a different code path.\n\nPrevention: parameterized queries / prepared statements bind user input as data, never as SQL syntax; ORMs (Hibernate, SQLAlchemy) use parameterization internally.\n\nsqlmap automates injection detection and exploitation; WAFs provide runtime signature detection but are not a substitute for proper parameterization.',
  },

  xss_attack: {
    summary: 'Cross-Site Scripting (XSS) injects malicious scripts into web pages viewed by other users, enabling session hijacking, credential theft, and DOM manipulation. Prevention centers on output encoding and Content Security Policy.',
    explanation: 'Reflected XSS: the malicious script is embedded in a URL parameter and reflected in the immediate HTTP response; requires tricking the victim into clicking the link.\n\nStored XSS: the payload is persisted in the database (comment, username, profile) and executed for every user who views that content — higher severity.\n\nDOM-based XSS: the vulnerability is entirely client-side; JavaScript reads attacker-controlled data (location.hash, document.referrer) and writes it to innerHTML without sanitization.\n\nCSP (Content-Security-Policy) header restricts allowed script sources (script-src \'self\') and blocks inline scripts without a nonce/hash — the strongest browser-side mitigation.\n\nHttpOnly cookie attribute prevents JavaScript from reading session cookies via document.cookie, limiting damage from XSS to non-cookie attacks.\n\nOutput encoding: escape HTML entities (<→&lt;, "→&quot;) in all rendered context; use framework-provided templating (React JSX auto-escapes, Jinja2 autoescaping).\n\nSanitization libraries (DOMPurify) are needed when user HTML must be allowed; allow-lists are safer than deny-lists.',
  },

  csrf_protection: {
    summary: 'Cross-Site Request Forgery tricks an authenticated user\'s browser into making an unintended state-changing request to a trusted site. The synchronizer token pattern and SameSite cookies are the primary defenses.',
    explanation: 'Attack: a malicious page includes <img src="https://bank.com/transfer?to=attacker&amount=1000">; the victim\'s browser sends the request with their session cookie automatically.\n\nSynchronizer token pattern: embed a server-generated random CSRF token in every HTML form; server validates it on POST — attackers cannot read the token due to same-origin policy.\n\nDouble-submit cookie: set a random value in both a cookie and a request parameter; server checks they match — works without server-side token storage.\n\nSameSite cookie attribute: Strict prevents the cookie from being sent on any cross-site request; Lax allows top-level GET navigations (safer default since Chrome 80); None requires Secure.\n\nOrigin/Referer header validation: verify the Origin header matches the expected site on state-changing requests — simple but can be absent in some requests.\n\nCSRF is distinct from CORS: CORS controls which cross-origin scripts can read responses; CSRF exploits the browser automatically sending credentials on cross-origin requests.',
  },

  oauth2_flow: {
    summary: 'OAuth 2.0 is an authorization delegation framework allowing third-party apps to access resources on behalf of users without sharing passwords. OpenID Connect (OIDC) adds an authentication layer on top with identity tokens.',
    explanation: 'Authorization Code Flow: user authenticates at authorization server → receives code → code exchanged for tokens at token endpoint; code is short-lived and single-use.\n\nPKCE (Proof Key for Code Exchange): SPAs and mobile apps generate a code_verifier (random) and send code_challenge = BASE64URL(SHA256(verifier)) in auth request; server verifies on exchange — prevents authorization code interception.\n\nClient Credentials Flow: machine-to-machine; client authenticates with client_id + client_secret to obtain access_token directly, no user involvement.\n\nDevice Flow: for input-constrained devices (TV, CLI); device displays user code + URL; user authenticates on another device; device polls token endpoint.\n\nTokens: access_token (short-lived, 1h, sent as Bearer in Authorization header), refresh_token (long-lived, used to obtain new access_token without re-auth).\n\nOpenID Connect adds id_token (JWT) with identity claims (sub, email, name); userinfo endpoint for additional claims; JWKS endpoint publishes signing keys for token verification.',
  },

  jwt_tokens: {
    summary: 'JSON Web Tokens (JWT) are self-contained, signed tokens encoding claims (identity, expiration, scopes) for stateless authentication and authorization. They eliminate per-request database lookups but require careful validation.',
    explanation: 'Structure: BASE64URL(header) + "." + BASE64URL(payload) + "." + signature. Header specifies alg (HS256, RS256, ES256) and typ.\n\nPayload registered claims: iss (issuer), sub (subject), exp (expiration Unix timestamp), iat (issued at), aud (audience); custom claims for roles/scopes.\n\nHS256 (symmetric): HMAC-SHA256 with shared secret — both parties need the secret; suitable for single-server auth.\n\nRS256 (asymmetric): RSA signature with private key; verify with public key (distributed from JWKS endpoint) — preferred for multi-service architectures.\n\nnone algorithm attack: attacker strips signature and sets alg:"none"; vulnerable servers skip verification — always explicitly reject the none algorithm.\n\nInsecure secrets: short or predictable HS256 secrets allow offline brute-force; use 256-bit random secrets.\n\nJWE (JSON Web Encryption) provides encrypted payloads for confidentiality; JWTs are only signed (verifiable) not encrypted by default.',
  },

  zero_trust_architecture: {
    summary: 'Zero Trust Security Architecture eliminates implicit trust based on network location, requiring continuous verification of every user, device, and request regardless of whether they originate inside or outside the perimeter.',
    explanation: 'Core principles: verify explicitly (authenticate and authorize every request using all available data), use least privilege access (JIT/JEA, risk-based adaptive policies), assume breach (minimize blast radius, segment access, encrypt all traffic).\n\nBeyondCorp (Google): replaced VPN with identity-aware proxy; access granted based on device health + user identity, not network location; all apps exposed via proxy with zero trust enforcement.\n\nmTLS (mutual TLS): both client and server present certificates; ensures service-to-service authentication in microservices without shared secrets.\n\nMicrosegmentation: divide network into small zones with fine-grained access policies between segments; limit lateral movement after breach.\n\nDevice posture checks: verify OS patch level, EDR agent, disk encryption, certificate validity before granting access.\n\nSASE (Secure Access Service Edge): converges SD-WAN and cloud-delivered security (CASB, SWG, ZTNA, FWaaS) into a unified service delivered from cloud PoPs.',
  },

  penetration_testing: {
    summary: 'Penetration testing simulates real-world attacks against systems to discover exploitable vulnerabilities before malicious actors do. It follows structured phases from reconnaissance through exploitation and reporting.',
    explanation: 'Reconnaissance: passive (OSINT — WHOIS, Shodan, LinkedIn, Google dorks) and active (DNS enumeration, subdomain brute-force).\n\nScanning: port scanning with nmap (-sV for version, -O for OS, --script for NSE), masscan for speed; vulnerability scanning with Nessus, OpenVAS.\n\nExploitation: Metasploit Framework (modules, payloads, post-exploitation); Burp Suite for web app testing (proxy, scanner, Intruder for brute-force, Repeater for manual testing).\n\nPost-exploitation: privilege escalation (sudo misconfig, SUID binaries, kernel exploits), lateral movement (pass-the-hash, Mimikatz for credential dumping), persistence.\n\nSocial engineering: phishing, vishing, physical access tests.\n\nRed team (full adversary simulation) vs Blue team (defenders) vs Purple team (collaborative exercises to improve detection and response).\n\nBug bounty platforms (HackerOne, Bugcrowd, Intigriti) enable continuous crowdsourced testing with defined scope and rewards.',
  },

  side_channel_attacks: {
    summary: 'Side-channel attacks extract secret information from physical implementation characteristics — timing, power consumption, electromagnetic emissions, or cache behavior — rather than weaknesses in the algorithm itself.',
    explanation: 'Timing attacks: measure execution time variation to infer secret key bits; RSA square-and-multiply, AES table lookups, and string comparison are classic targets; countermeasure: constant-time implementations.\n\nSimple Power Analysis (SPA): single trace reveals operations (e.g., bit=1 → square+multiply vs bit=0 → square only in RSA).\n\nDifferential Power Analysis (DPA): statistical analysis of many power traces using a leakage model; can extract AES keys from embedded devices.\n\nFlush+Reload cache attack: attacker shares memory page with victim (shared library), flushes a cache line, lets victim execute, then measures reload time to determine if victim accessed that line.\n\nPrime+Probe: no shared memory required; attacker primes a cache set, waits for victim, probes access time; exploited in Spectre/Meltdown.\n\nSpectre: exploits speculative execution to read across process boundaries via cache side channel; not fully mitigable without performance penalty (Retpoline, IBRS, STIBP).\n\nCountermeasures: noise injection, power line filtering, hardware isolation, masking (XOR key with random mask), constant-time code patterns.',
  },

  post_quantum_crypto: {
    summary: 'Post-quantum cryptography (PQC) develops cryptographic algorithms secure against both classical and quantum computers. NIST finalized its first PQC standards in 2024 based on lattice and hash problems.',
    explanation: 'Threat: Shor\'s algorithm runs in polynomial time on a quantum computer and factors integers / solves discrete logarithm, breaking RSA, DH, ECDH, ECDSA.\n\nGrover\'s algorithm provides quadratic speedup for symmetric key search — double key sizes (AES-128 → AES-256) suffice.\n\nNIST PQC standards (FIPS 203/204/205, 2024):\n  CRYSTALS-Kyber (FIPS 203): key encapsulation (KEM), based on Module-LWE lattice problem.\n  CRYSTALS-Dilithium (FIPS 204): digital signatures, based on Module-LWE + Module-SIS.\n  SPHINCS+ (FIPS 205): hash-based signatures, conservative security assumption.\n\nLattice hardness: Learning With Errors (LWE) — solve linear system A·s + e = b (mod q) with small error vector e; believed hard for quantum computers.\n\nHybrid schemes: combine classical (ECDH) + PQC (Kyber) for transition period — secure if either remains unbroken.\n\n"Harvest now, decrypt later": adversaries collect encrypted traffic today to decrypt once quantum computers mature; motivates urgent migration of long-lived secrets.',
  },

  homomorphic_encryption: {
    summary: 'Homomorphic encryption (HE) allows arbitrary computation on encrypted data without decryption, enabling privacy-preserving cloud computation. Fully homomorphic encryption (FHE) supports arbitrary circuits at significant overhead.',
    explanation: 'Partial HE (PHE): supports one operation type. Paillier: additively homomorphic (Enc(a)·Enc(b) = Enc(a+b)); used in private voting, privacy-preserving aggregation.\n\nSomewhat HE (SHE): supports limited additions + multiplications before noise overwhelms ciphertext.\n\nFully HE (FHE): bootstrapping refreshes ciphertext noise, enabling unlimited operations; proposed by Gentry (2009) using ideal lattices.\n\nBFV/BGV schemes: exact integer arithmetic; CKKS: approximate arithmetic on real/complex numbers (suitable for ML inference, statistics).\n\nCKKS overhead: ~10³–10⁶× slower than plaintext; practical for batching (SIMD packing of thousands of values into one ciphertext using NTT).\n\nApplications: privacy-preserving ML inference, genomic analysis, private set intersection.\n\nLibraries: SEAL (Microsoft), OpenFHE, HElib (IBM); hardware acceleration (GPU, FPGA) actively researched.',
  },

  zero_knowledge_proofs: {
    summary: 'Zero-knowledge proofs (ZKPs) allow a prover to convince a verifier that a statement is true without revealing any information beyond the statement\'s truth. They are foundational to blockchain privacy, identity systems, and verifiable computation.',
    explanation: 'Formal properties: completeness (honest prover convinces honest verifier), soundness (cheating prover cannot convince with negligible probability), zero-knowledge (verifier learns nothing except truth of statement).\n\nSigma protocols (interactive): 3-move commit-challenge-response; example: Schnorr protocol for proving knowledge of discrete log without revealing it.\n\nFiat-Shamir transform: replace interactive verifier challenge with hash of transcript → non-interactive ZKP (NIZK); enables offline proofs.\n\nzk-SNARKs: O(1) proof size regardless of computation size, fast verification; require trusted setup (toxic waste ceremony) for some schemes.\n\nzk-STARKs: no trusted setup, post-quantum secure, larger proof size (~100KB vs ~0.5KB); used in StarkNet.\n\nApplications: Zcash (shielded transactions), Ethereum L2 validity proofs (zkEVM), anonymous credentials, range proofs.',
  },

  secure_enclave_tee: {
    summary: 'Trusted Execution Environments (TEEs) provide isolated, hardware-protected computation where even the OS, hypervisor, or cloud provider cannot access the code or data inside, enabling confidential computing.',
    explanation: 'Intel SGX (Software Guard Extensions): defines encrypted memory regions (enclaves); Memory Encryption Engine (MEE) transparently encrypts enclave pages in DRAM; attestation via EPID/DCAP proves enclave identity remotely.\n\nAttack surface: side-channel attacks (cache timing, Spectre variants) remain a challenge; SGX has been attacked via Foreshadow, PlunderVolt.\n\nARM TrustZone: SoC partitioned into secure world (trusted OS, key storage, DRM) and normal world; hardware isolation at bus level; used in mobile payment, biometric authentication.\n\nAMD SEV (Secure Encrypted Virtualization): encrypts VM memory with per-VM keys; SEV-SNP adds integrity protection and attestation; used in confidential VMs on Azure, GCP, AWS.\n\nApplications: key management (HSM replacement), ML inference on sensitive data, blockchain key protection.\n\nAttestation: remote party verifies the enclave measurement (cryptographic hash of code + config) against expected value; ensures code integrity before sending secrets in.',
  },

  formal_verification_sec: {
    summary: 'Formal verification mathematically proves program correctness with respect to a specification, eliminating entire classes of bugs that testing cannot exhaustively find. Applied to OS kernels, cryptographic protocols, and compilers.',
    explanation: 'Model checking: automatically explores all reachable states of a finite-state model; SPIN verifies concurrent systems in PROMELA; TLA+ models distributed algorithms; BDD/SAT-based symbolic model checking scales to larger state spaces.\n\nTheorem proving: interactive provers (Coq, Isabelle/HOL, Lean 4) require human-guided proof construction but handle infinite state; automated provers (Z3 SMT solver) discharge verification conditions.\n\nSeparation logic: extends Hoare logic with spatial connectives (★ for disjoint heap regions) enabling modular heap reasoning; used by Facebook Infer for automated bug finding at scale.\n\nCryptographic protocol verification: ProVerif (symbolic, Dolev-Yao model), Tamarin; can prove secrecy, authentication, forward secrecy for TLS, SSH, Signal.\n\nseL4: first formally verified general-purpose OS microkernel; Isabelle proof that C code implements abstract spec.\n\nCompCert: formally verified C compiler (Coq); guarantees compiled code preserves source semantics; used in safety-critical aviation software.',
  },

  threat_modeling: {
    summary: 'Threat modeling is a structured process for identifying, prioritizing, and mitigating security threats to a system during the design phase. It produces actionable security requirements before code is written.',
    explanation: 'Process: define system scope (assets, trust boundaries), enumerate threats, assess risk, define mitigations.\n\nSTRIDE framework (Microsoft): Spoofing (authenticate identity), Tampering (data integrity), Repudiation (non-repudiation/logging), Information Disclosure (confidentiality), Denial of Service (availability), Elevation of Privilege (authorization).\n\nAttack trees: root = attacker goal, children = sub-goals or attack methods; leaf nodes = primitive attacks; enables cost-benefit analysis of mitigations.\n\nData Flow Diagrams (DFDs): trust boundaries drawn where data crosses security domains; every crossing is a potential threat surface.\n\nDREAD scoring: Damage, Reproducibility, Exploitability, Affected Users, Discoverability; produces ordinal risk score for prioritization.\n\nPASTA (Process for Attack Simulation and Threat Analysis): risk-centric 7-stage methodology aligned to business objectives.',
  },

  malware_analysis: {
    summary: 'Malware analysis combines static (without execution) and dynamic (runtime) techniques to understand a malicious program\'s behavior, capabilities, and indicators of compromise for detection and response.',
    explanation: 'Static analysis: compute file hash (MD5/SHA256) for threat intel lookup; extract strings (URLs, IPs, registry keys, API names); analyze PE headers (imported DLLs, sections, entropy for packing detection); disassemble with IDA Pro or Ghidra.\n\nDynamic analysis: execute in isolated sandbox (Cuckoo Sandbox); monitor API calls (CreateFile, RegSetValue, connect), network traffic (Wireshark), filesystem changes, registry modifications, process injection.\n\nPacking and obfuscation: malware compresses/encrypts its own code (UPX, custom); unpacking via OEP (Original Entry Point) hunting; obfuscation uses dead code, opaque predicates, string encryption.\n\nAnti-analysis techniques: detect VM presence (CPUID, timing), detect debugger (IsDebuggerPresent, TLS callbacks), sleep-based evasion.\n\nYARA rules: pattern-matching language for malware signatures; match on strings, byte sequences, PE structure; used by VirusTotal and AV engines.\n\nIOC (Indicators of Compromise): file hashes, IP/domain, mutex names, registry keys — shared via STIX/TAXII for threat intelligence.',
  },

  intrusion_detection: {
    summary: 'Intrusion Detection and Prevention Systems (IDS/IPS) monitor network and host activity for malicious patterns. Modern deployments combine signature, anomaly, and behavioral detection with centralized SIEM correlation.',
    explanation: 'Network IDS (NIDS): passive tap or SPAN port analyzes all traffic; Snort and Suricata use rule-based signature matching (protocol decode + pattern match).\n\nSignature-based detection: fast, low false-positive rate, but blind to zero-days; rules maintained in Emerging Threats, Snort community rulesets.\n\nAnomaly-based detection: establish behavioral baseline; alert on statistical deviation (unusual port, high volume, rare process); higher false positive rate; ML-based UEBA (User/Entity Behavior Analytics).\n\nHIDS (Host IDS): monitors OS events — file integrity (OSSEC, Tripwire), log analysis, rootkit detection.\n\nIPS (Intrusion Prevention System): inline deployment, can drop/reset connections; latency impact; risk of blocking legitimate traffic.\n\nSIEM (Security Information & Event Management): aggregates logs from network, host, cloud; correlation rules detect multi-step attacks.\n\nEDR (Endpoint Detection & Response): agent collects process, file, network telemetry; behavioral detection; threat hunting.',
  },

  container_security: {
    summary: 'Container security spans image scanning, runtime isolation, network policies, and supply chain integrity to prevent attackers from exploiting containerized workloads or escaping to the host.',
    explanation: 'Image scanning: Trivy and Grype scan image layers against CVE databases; integrate into CI pipeline to block images with critical CVEs; scan base OS packages and language dependencies.\n\nRuntime isolation: seccomp profiles restrict syscall surface; AppArmor/SELinux Mandatory Access Control policies restrict file/network access; capabilities: drop ALL, add back only needed (CAP_NET_BIND_SERVICE).\n\nRootless containers: run container daemon and containers as non-root user; limits host impact if container escape occurs; Podman natively rootless.\n\nKubernetes security: Pod Security Standards (Restricted, Baseline, Privileged); NetworkPolicy for pod-to-pod traffic control; RBAC for API access; admission controllers (OPA Gatekeeper, Kyverno) enforce policy.\n\nRead-only root filesystem: mounts / as read-only, only explicitly defined volumes are writable — contains attacker ability to persist.\n\nSupply chain: SBOM (Software Bill of Materials) documents all components; Sigstore/cosign signs container images with keyless OIDC-based attestation.',
  },

  secrets_management: {
    summary: 'Secrets management securely stores, distributes, and rotates sensitive credentials (API keys, DB passwords, TLS certificates) to eliminate hardcoded secrets and reduce breach impact through dynamic, short-lived credentials.',
    explanation: 'HashiCorp Vault: secrets engine model — dynamic secrets (Vault generates short-lived DB credentials on-demand, auto-revokes on lease expiry), PKI engine (issue/renew TLS certs), transit engine (encryption-as-a-service).\n\nVault auth methods: AppRole (machine-to-machine), Kubernetes service account JWT (pods authenticate natively), AWS IAM role; audit log records every secret access.\n\nKubernetes Secrets: base64-encoded values stored in etcd (not encrypted by default); enable etcd encryption at rest + use external-secrets-operator to sync from Vault/AWS Secrets Manager.\n\nAWS Secrets Manager: managed service; automatic rotation via Lambda; cross-account access via resource policy.\n\nEnvironment variable injection: prefer secrets injected at runtime (Vault Agent sidecar, CSI driver) over environment variables (visible in /proc/PID/environ, Docker inspect).\n\nPrinciples: never commit secrets to Git (git-secrets, trufflehog pre-commit scan); rotate regularly; different credentials per environment.',
  },

  cryptographic_protocol_design: {
    summary: 'Cryptographic protocol design applies established principles — forward secrecy, key separation, minimal trust — to build secure communication systems. The Signal double ratchet protocol exemplifies modern best practices.',
    explanation: 'Diffie-Hellman key exchange: Alice sends g^a mod p, Bob sends g^b mod p; shared secret g^ab mod p without ever transmitting it; ECDH uses elliptic curve groups for equivalent security at smaller key sizes.\n\nForward secrecy (perfect forward secrecy): use ephemeral DH keys for each session; compromise of long-term identity key does not expose past session keys; TLS 1.3 mandates forward secrecy (ECDHE only).\n\nSignal Protocol — double ratchet: combines DH ratchet (new DH keys each message round-trip, self-healing) with symmetric-key ratchet (KDF chain for each message direction); provides forward secrecy + break-in recovery.\n\nX3DH (Extended Triple Diffie-Hellman): asynchronous session establishment allowing offline pre-key bundles.\n\nKey separation: derive distinct keys for different purposes (encryption key, MAC key, IV) from master key using HKDF; prevents cross-protocol attacks.\n\nDesign principles: use standard primitives (AES-GCM, ChaCha20-Poly1305, SHA-256, X25519), never design custom crypto, minimize trusted parties, authenticate all messages (AEAD).',
  },

// ── CLOUD & DEVOPS ────────────────────────────────────────────

  aws_ec2_basics: {
    summary: 'Amazon EC2 provides resizable virtual machines in the cloud with fine-grained instance type selection, Auto Scaling for demand-driven capacity, and Spot Instances for cost reduction. It is the foundation of most AWS architectures.',
    explanation: 'Instance types: general purpose (m-series), compute-optimized (c-series), memory-optimized (r/x-series), GPU (p/g-series), storage-optimized (i-series); choose by bottleneck (CPU, RAM, network, disk IOPS).\n\nAuto Scaling: defines min/desired/max instance count; scaling policies: target tracking (maintain CPUUtilization=50%), step scaling (add N instances at N% threshold), scheduled (predictable load).\n\nSpot Instances: bid on spare capacity at 60-90% discount; 2-minute interruption notice; suitable for fault-tolerant, stateless workloads (batch, CI, rendering).\n\nPlacement groups: cluster (low latency, high throughput, same AZ), spread (max 7 instances/AZ, hardware isolation for HA), partition (Hadoop/Cassandra topology awareness).\n\nEBS volumes: gp3 (baseline 3000 IOPS, tunable), io2 Block Express (256K IOPS, mission-critical); instance store (NVMe, ephemeral, highest IOPS).\n\nUser data scripts + EC2 metadata service (IMDSv2 requires PUT token to prevent SSRF) + Systems Manager (no SSH, agent-based management).',
  },

  kubernetes_helm: {
    summary: 'Helm is the de facto package manager for Kubernetes, bundling resources into versioned Charts with templated YAML, enabling repeatable deployments, release management, and dependency tracking across environments.',
    explanation: 'Chart structure: Chart.yaml (metadata), values.yaml (defaults), templates/ (Go template YAML manifests), charts/ (sub-chart dependencies), helpers.tpl (named templates).\n\nRelease lifecycle: helm install, helm upgrade --install, helm rollback, helm uninstall; release state stored in Kubernetes Secrets.\n\nValues hierarchy: values.yaml → -f custom.yaml → --set key=value (highest priority); useful for environment-specific overrides (dev/staging/prod).\n\nHelmfile and ArgoCD: helmfile.yaml declares multiple releases declaratively; ArgoCD uses Helm as an application source, compares live vs desired state, auto-syncs on git push.\n\nChart testing: helm lint (validate syntax), helm template (render manifests locally), ct (chart-testing CI tool), helm test (run test Pod defined in chart).\n\nHelm 3 improvements over v2: removed Tiller (server-side component, security risk), added 3-way merge patches, OCI chart registry support.',
  },

  terraform_iac: {
    summary: 'Terraform is a declarative Infrastructure-as-Code tool by HashiCorp that provisions cloud resources across providers using HCL syntax. Its plan-apply workflow and state management enable safe, reproducible infrastructure changes.',
    explanation: 'HCL syntax: resource "aws_instance" "web" { ami = "..." instance_type = "t3.micro" }; data sources query existing infrastructure; variables parameterize modules.\n\nState file: JSON representation of deployed infrastructure; maps HCL resources to real-world IDs; remote state in S3+DynamoDB lock prevents concurrent apply conflicts.\n\nPlan/Apply workflow: terraform plan shows diff (create/update/destroy) without changes; terraform apply executes; -target for targeted applies; -auto-approve for CI (use carefully).\n\nModules: reusable configuration units; root module composes child modules; registry.terraform.io hosts community modules; enforce module version pins.\n\nProviders: plugins for each cloud (AWS, GCP, Azure, Kubernetes, Vault); provider version locking in required_providers block; terraform init downloads providers.\n\nTerragrunt: thin wrapper adding DRY module instantiation (generate.tf blocks), environment-specific overrides, dependency ordering across modules.\n\nSentinel/OPA: policy-as-code gates on terraform plan output (enforce tagging, instance type limits, security group rules).',
  },

  docker_compose: {
    summary: 'Docker Compose defines and runs multi-container applications with a single docker-compose.yml file, orchestrating service dependencies, networking, volumes, and environment variables for local development and simple production deployments.',
    explanation: 'Compose file: services (container definitions), networks (custom bridge networks), volumes (named volumes); version 3.x for Swarm compatibility.\n\nService definition: image or build context, ports (host:container), environment variables (env_file for secrets), volumes, depends_on (startup order).\n\ndepends_on with condition: depends_on: db: condition: service_healthy combined with healthcheck (curl -f http://localhost/health) ensures container is ready before dependent starts.\n\nProfiles: define optional services (--profile debug) to start only when needed; useful for dev tools (pgAdmin, mail catcher) not needed in production.\n\ndocker compose up -d (detached), --build (rebuild images), down -v (remove volumes); watch mode (docker compose watch) for file-sync hot reload in development.\n\nCompose vs Kubernetes: Compose is simpler for local dev/small deployments; Kubernetes for production scale, self-healing, rolling updates; Kompose converts Compose to Kubernetes manifests.',
  },

  ci_cd_github_actions: {
    summary: 'GitHub Actions is a CI/CD platform integrated with GitHub that automates build, test, and deploy workflows triggered by repository events. It uses YAML workflow files with reusable actions from the marketplace.',
    explanation: 'Workflow structure: on (triggers: push, pull_request, schedule, workflow_dispatch), jobs (parallel by default), steps (sequential actions/commands).\n\nRunners: GitHub-hosted (ubuntu-latest, windows-latest, macos-latest) or self-hosted (custom hardware, on-premise, ARM); runner groups for security isolation.\n\nActions: atomic units of functionality; uses: actions/checkout@v4, actions/setup-node@v4; create custom actions in JavaScript, Docker, or composite steps.\n\nSecrets and variables: encrypted secrets (Settings > Secrets), environment variables, environment-scoped secrets (staging/production separation) with required approvals.\n\nMatrix strategy: test across multiple OS/language versions simultaneously; fail-fast: false continues other jobs on partial failure.\n\nCaching: actions/cache with key based on hash of lock file (package-lock.json, poetry.lock) dramatically speeds up dependency installation.\n\nReusable workflows: workflow_call trigger allows composing workflows across repos; reduces duplication of CI logic across microservices.',
  },

  prometheus_monitoring: {
    summary: 'Prometheus is a pull-based metrics monitoring system with a multi-dimensional data model and PromQL query language. It scrapes HTTP /metrics endpoints, stores time-series data, and feeds Grafana dashboards and Alertmanager.',
    explanation: 'Data model: metric name + label set → time series; labels enable multi-dimensional queries; e.g., http_requests_total{method="GET", status="200"}.\n\nMetric types: Counter (monotonically increasing, rate() for per-second rate), Gauge (arbitrary up/down value, e.g., memory), Histogram (bucket distribution, histogram_quantile(0.99,...)), Summary (pre-computed quantiles, less flexible).\n\nPromQL: rate(http_requests_total[5m]) — per-second rate over 5-minute window; sum by (status) — aggregate; topk(5, ...) — top N; histogram_quantile(0.99, sum by (le) rate(...)) — p99 latency.\n\nScrape config: prometheus.yml defines scrape_configs with job_name, static_configs or kubernetes_sd_configs (service discovery); relabeling rules transform labels.\n\nAlertmanager: receives firing alerts from Prometheus, handles grouping (same alert many instances), inhibition (mute lower-severity if higher firing), routing (email, Slack, PagerDuty).\n\nRemote write: Prometheus → Thanos/Cortex/VictoriaMetrics for long-term storage and multi-region querying; Prometheus designed for 2-week retention by default.',
  },

  grafana_dashboards: {
    summary: 'Grafana is the leading open-source observability visualization platform, connecting to metrics (Prometheus), logs (Loki), traces (Tempo), and databases to build interactive dashboards and unified alerts.',
    explanation: 'Data sources: Prometheus (metrics), Loki (logs), Tempo (traces), Elasticsearch, CloudWatch, InfluxDB, PostgreSQL — mix on a single dashboard.\n\nPanel types: Time series (line/bar), Stat (single value with thresholds), Gauge, Heatmap, Table, Logs panel, Traces panel; Geomap for geographic data.\n\nVariables: dashboard-level template variables (data source query or custom list) enable interactive filtering; $cluster, $namespace, $pod dropdowns cascade to all panels.\n\nAlerts: unified alerting evaluates alert rules on any data source; alert state machine (Normal → Pending → Firing → Resolved); notification policies route to contact points.\n\nLoki integration: LogQL — {app="nginx"} | pattern <ip> - - <timestamp> | rate; label extraction via JSON/logfmt parser; correlate log traces with metrics.\n\nGrafana as Code: Grafonnet (Jsonnet library) and Terraform Grafana provider manage dashboards as code; dashboard JSON models in git for version control and review.\n\nEnterprise features: RBAC, teams, folder permissions; LGTM stack (Loki, Grafana, Tempo, Mimir) as integrated observability platform.',
  },

  ansible_automation: {
    summary: 'Ansible is an agentless IT automation tool using SSH and Python to execute idempotent tasks defined in YAML playbooks. It handles configuration management, application deployment, and orchestration without requiring agents on target hosts.',
    explanation: 'Architecture: control node runs ansible; managed nodes require only SSH + Python; no agent installation; push-based model.\n\nPlaybook structure: play (targets + vars + roles + tasks), task (module call with args), handler (triggered by notify, runs once at play end).\n\nModules: apt/yum (package), file (permissions), copy/template (Jinja2 templates), service (systemd), command/shell (raw), docker_container, aws_ec2; 6000+ modules in collections.\n\nInventory: static (INI/YAML file) or dynamic (scripts / inventory plugins for EC2, GCP, Azure); group_vars/ and host_vars/ for variable hierarchies.\n\nRoles: reusable units (tasks/, handlers/, templates/, defaults/vars/); ansible-galaxy install community.postgresql; organize large playbooks into composable roles.\n\nIdempotency: most modules check desired state before acting (file: state=file only creates if absent); command/shell modules are NOT idempotent by default → use creates/removes.\n\nAnsible Vault: encrypt sensitive vars (passwords, keys) at rest; vault-encrypted strings inline in playbooks; CI decrypts with vault password from environment.',
  },

  service_mesh_istio: {
    summary: 'Istio is a service mesh that adds traffic management, mutual TLS authentication, observability, and fine-grained access policies to microservices by injecting sidecar proxies (Envoy) into each pod without application changes.',
    explanation: 'Sidecar injection: Istio automatically injects an Envoy proxy container alongside each application container; all inbound/outbound traffic flows through the proxy.\n\nmTLS: Istio issues workload certificates (SPIFFE SVIDs) and enforces mutual TLS between services; PeerAuthentication policy; no application code changes required.\n\nTraffic management: VirtualService (routing rules: weight-based A/B testing, header-based routing, fault injection), DestinationRule (connection pool, circuit breaker, TLS settings), Gateway (ingress/egress).\n\nObservability: Envoy emits L7 metrics (request count, latency, error rate) → Prometheus; distributed tracing (Zipkin/Jaeger span headers propagated); access logs with full request context.\n\nCircuit breaking: outlier detection (eject unresponsive hosts after N consecutive 5xx errors); load balancing (round-robin, least-conn, consistent hash on cookie/header).\n\nSecurity policies: AuthorizationPolicy allows/denies requests by source principal, namespace, method, path — fine-grained zero-trust access control.\n\nIstio Ambient Mesh (2022): moves proxy from sidecar to per-node ztunnel (L4) and waypoint proxies (L7); reduces overhead and simplifies lifecycle.',
  },

  serverless_functions: {
    summary: 'Serverless functions (AWS Lambda, GCP Cloud Functions, Azure Functions) execute code in response to events without provisioning servers, charging only for compute time used. They excel at event-driven, stateless, bursty workloads.',
    explanation: 'Execution model: function container initialized on first invocation (cold start); subsequent invocations reuse warm container (no initialization cost); concurrent invocations spawn independent instances.\n\nCold start latency: JVM/dotnet runtimes: 500ms–2s; Python/Node: 50–200ms; compiled Go/Rust: <50ms; SnapStart (Lambda): pre-warm snapshots eliminate JVM cold start.\n\nEvent sources: API Gateway (HTTP), S3 (object events), SQS (queue consumer), DynamoDB Streams (change data capture), SNS, EventBridge (scheduled cron + event bus), Kinesis.\n\nTrigger patterns: fan-out (SNS → multiple Lambda), fan-in (SQS → Lambda batch processor), choreography (each Lambda emits events to trigger next step).\n\nStatelessness: no shared in-process state between invocations; use DynamoDB/Redis/S3 for state; /tmp (512MB–10GB) ephemeral storage within one container lifetime.\n\nPricing: pay per 1ms of compute + number of invocations; Lambda free tier: 1M requests/month; cost model extremely favorable for low/variable traffic.\n\nObservability: Lambda Powertools (structured logging, tracing, metrics); X-Ray distributed tracing; CloudWatch Logs Insights for log analysis.',
  },

  observability_otel: {
    summary: 'OpenTelemetry (OTel) is the CNCF standard for unified observability instrumentation, providing vendor-neutral APIs and SDKs to collect traces, metrics, and logs from applications and export them to any backend.',
    explanation: 'Three pillars: traces (request flow across services), metrics (numeric measurements over time), logs (structured event records); OTel unifies all three with correlation via trace_id/span_id.\n\nDistributed tracing: a trace is a DAG of spans; each span records operation name, timestamps, attributes (http.method, db.statement), events, and status; propagated via W3C TraceContext headers (traceparent, tracestate).\n\nOTel SDK: auto-instrumentation agents for popular frameworks (Spring, Django, Express, Rails) capture HTTP requests, DB queries, messaging without code changes; manual instrumentation for business logic spans.\n\nOTel Collector: gateway agent collects from multiple sources; processors (batch, filter, transform attributes); exporters (Jaeger, Zipkin, Prometheus, Loki, any OTLP-compatible backend).\n\nExemplar linking: Prometheus metrics carry embedded trace IDs as exemplars; Grafana uses these to jump from metric spike to the exact trace causing it.\n\nSampling: head-based (decide at trace root, e.g., 1%), tail-based (decide after trace complete, sample all traces with errors); balance storage cost vs visibility.',
  },

  sre_practices: {
    summary: 'Site Reliability Engineering (SRE) applies software engineering to operations, defining reliability targets via SLOs, measuring with SLIs, and using error budgets to balance innovation velocity with system stability.',
    explanation: 'SLI (Service Level Indicator): quantitative measure of service behavior — availability (successful requests / total), latency (p99 < 500ms), throughput, error rate.\n\nSLO (Service Level Objective): target value for an SLI over a rolling window (99.9% availability over 30 days = 43.8 minutes/month downtime budget).\n\nError budget: 100% - SLO = allowed unreliability; when budget exhausted, freeze feature releases, focus on reliability work; when budget full, invest in velocity.\n\nToil: operational work that is manual, repetitive, automatable, tactical, devoid of lasting value — SRE goal is to keep toil < 50% of time; automate toil away.\n\nIncident management: define severity levels (P0-P4), incident commander, comms lead; blameless postmortem (5 Whys, contributing factors, action items); share postmortems org-wide.\n\nRunbooks: documented step-by-step procedures for known failure modes; linked from alerts; enable consistent incident response without tribal knowledge.\n\nCapacity planning: demand forecasting, lead time analysis, load testing (Locust, k6, Gatling); design for N+2 redundancy; SRE Production Readiness Reviews before launch.',
  },

  chaos_engineering: {
    summary: 'Chaos Engineering proactively injects controlled failures into production systems to discover systemic weaknesses before they cause unexpected outages. It builds confidence in system resilience by verifying failure hypotheses experimentally.',
    explanation: 'Principles (Principles of Chaos Engineering, 2014): start with steady state, hypothesize about perturbation, run experiments in production, minimize blast radius.\n\nExperiment types: pod kill (kill random pod, verify service continues), node drain (evict all pods from node, verify rescheduling), network partition (block traffic between services), latency injection (add 500ms to DB calls), CPU spike (saturate cores).\n\nTools: Chaos Monkey (Netflix, terminates random VMs), Chaos Toolkit (declarative experiments), AWS Fault Injection Simulator (AWS-native), LitmusChaos (Kubernetes operator), Gremlin (SaaS platform).\n\nGamedays: scheduled chaos experiments with full incident response team engaged; validates runbooks, on-call procedures, monitoring completeness.\n\nBlast radius control: target canary percentage of traffic, time-box experiments, have kill switches, start in staging before production, validate steady state before and after.\n\nChaos as CI: integrate controlled chaos experiments into deployment pipeline; verify service mesh circuit breakers, retry logic, graceful degradation at every deploy.',
  },

  blue_green_deployment: {
    summary: 'Blue/green deployment maintains two identical production environments and switches traffic between them for zero-downtime releases. Canary deployments gradually shift a percentage of traffic to the new version for progressive validation.',
    explanation: 'Blue/green: blue is current live, green is new version fully deployed; switch load balancer/DNS to green after validation; instant rollback by switching back; doubles infrastructure cost during deployment.\n\nCanary deployment: route 1% → 5% → 20% → 100% of traffic to new version over time; monitor SLIs (error rate, latency) at each stage; automated rollback if SLO violated.\n\nFeature flags: decouple deployment from release; ship code to all users but enable feature for subset; LaunchDarkly, Split.io, Unleash; enables trunk-based development.\n\nKubernetes rollout: kubectl rollout (spec.strategy: RollingUpdate with maxSurge/maxUnavailable); blue/green via switching Service selector between two Deployments.\n\nArgoCd rollouts: CRD extending Kubernetes with blue/green and canary strategies, automated analysis (AnalysisRun runs metrics queries to validate new version).\n\nDatabase migrations: backwards-compatible migrations (add column before code uses it, remove after old code version gone); expand-contract pattern; never rename columns in one step.',
  },

  gitops_workflow: {
    summary: 'GitOps uses Git as the single source of truth for infrastructure and application state, with automated operators continuously reconciling the live cluster state with the desired state declared in Git.',
    explanation: 'Core principles: declarative (desired state in Git as YAML), versioned (Git history = audit trail), automated (operator reconciles continuously), self-healing (operator corrects drift).\n\nArgoCD: Kubernetes operator; Application CRD references Git repo + path + target cluster; syncs every 3 minutes or on webhook; detects drift, shows diff, auto-syncs or requires manual approval.\n\nFlux: alternative GitOps operator; Kustomization and HelmRelease CRDs; multi-tenancy via separate namespaces per team; ImageUpdateAutomation to commit updated image tags to Git.\n\nEnvironment promotion: dev → staging → prod via separate Git branches or directories; PR-based promotion with approval; automated promotion if canary analysis passes.\n\nSecrets in GitOps: encrypt secrets with Sealed Secrets (controller decrypts in cluster), External Secrets Operator (sync from Vault/AWS), SOPS (encrypt YAML values).\n\nMulti-cluster: ArgoCD ApplicationSet generates Application per cluster from cluster list; cluster fleet management; synced from same Git repo with environment-specific values.\n\nDrift detection: ArgoCD marks apps OutOfSync when cluster diverges from Git; alerts on drift; prohibit direct kubectl apply in production (enforce via admission webhook).',
  },

  cloud_networking_vpc: {
    summary: 'Virtual Private Cloud (VPC) provides isolated, configurable network environments in the cloud with subnets, routing tables, security groups, and peering. Proper VPC design is fundamental to cloud security and connectivity.',
    explanation: 'VPC components: CIDR block (e.g., 10.0.0.0/16), subnets (public/private, per AZ), route tables (0.0.0.0/0 → IGW for public, → NAT GW for private), Internet Gateway (IGW), NAT Gateway.\n\nSecurity layers: Security Groups (stateful, instance-level, allow rules only), Network ACLs (stateless, subnet-level, allow/deny, evaluated in order), WAF (L7 rule filtering for ALB/CloudFront).\n\nVPC peering: direct, non-transitive connection between two VPCs (same or different accounts/regions); no transitive routing (A peered B, B peered C does not allow A→C); AWS Transit Gateway solves transitive routing.\n\nPrivateLink / VPC Endpoints: access AWS services (S3, DynamoDB, Secrets Manager) without traversing internet; interface endpoints (ENI, per-service) or gateway endpoints (S3, DynamoDB).\n\nDirect Connect: dedicated physical connection (1/10/100 Gbps) from on-premise to AWS; consistent latency, not public internet; Virtual Private Gateway or Direct Connect Gateway.\n\nIPAM (IP Address Management): plan RFC1918 address space carefully to avoid overlap; reserve separate CIDR ranges per region and account for future peering; /24 per subnet, /20 per AZ.',
  },

  immutable_infrastructure: {
    summary: 'Immutable infrastructure treats servers as disposable: never modify running instances, instead replace them with newly built, versioned images. This eliminates configuration drift, simplifies rollback, and improves security posture.',
    explanation: 'Principle: servers are "cattle, not pets"; no SSH or manual changes in production; all changes go through the build pipeline to produce a new image.\n\nPacker: HashiCorp tool to build identical machine images (AMI, Docker image, Vagrant box) from a template; installs packages, copies config files, runs provisioners.\n\nBootstrap process: base AMI (hardened OS, monitoring agents) → application AMI (application runtime, config baked in); user data or cloud-init for minimal runtime configuration (environment name, service discovery endpoint).\n\nImmutable deployments: deploy new ASG with new AMI → shift traffic → delete old ASG; no in-place upgrades; identical instances in every environment (no "works on staging, breaks in prod").\n\nConfiguration drift: classic mutable servers accumulate differences over time (manual hotfixes, package updates, config changes) leading to "snowflake servers"; immutable model eliminates drift entirely.\n\nContainers as immutable: Docker image is the natural expression of immutability; image digest (sha256) guarantees exact reproducibility; never use :latest tag in production.\n\nSecurity benefit: no SSH reduces attack surface; no package manager running in production container (distroless, scratch images); short-lived instances limit damage from compromise.',
  },

// ── COMPUTER GRAPHICS ─────────────────────────────────────────

  rasterization_pipeline: {
    summary: 'The GPU rasterization pipeline transforms 3D scene geometry into 2D pixel fragments through vertex processing, primitive assembly, rasterization, and fragment shading, enabling real-time rendering at interactive frame rates.',
    explanation: 'Stages: vertex shader (model → clip space via MVP matrices) → primitive assembly (triangles) → rasterization (triangle → fragment grid) → fragment shader (per-pixel color) → output merger (depth test, blending).\n\nMVP transformation: Model matrix (object space → world space), View matrix (world → camera space via lookAt), Projection matrix (camera → clip space, perspective divide for NDC).\n\nRasterization: for each triangle, compute bounding box, test each covered pixel via barycentric coordinates (w0, w1, w2 ≥ 0 for inside); interpolate vertex attributes across fragment.\n\nDepth buffer (z-buffer): each pixel stores min depth seen; fragment rejected if its depth > stored value (depth test); eliminates painter\'s algorithm sorting; precision issues with reversed-Z.\n\nEarly-Z: hardware optimization; depth test before fragment shader to skip expensive shading for occluded fragments; requires no alpha discard in fragment shader.\n\nTile-based rendering (mobile GPUs): Mali, Apple GPU divide screen into tiles; process all geometry per tile in fast on-chip memory before writeback; reduces bandwidth vs immediate mode.\n\nModern API (Vulkan/DirectX12): explicit control over render passes, resource barriers, command buffer recording; multi-threaded command submission; reduced driver overhead vs OpenGL.',
  },

  ray_tracing_basics: {
    summary: 'Ray tracing simulates light transport by tracing rays from the camera through each pixel, computing intersections with scene geometry and recursively tracing shadow, reflection, and refraction rays for physically accurate rendering.',
    explanation: 'Whitted ray tracing: for each pixel, cast primary ray; on hit, cast shadow rays to all lights, reflection ray, refraction ray (if transparent); recursively trace until max depth or no hit.\n\nRay-sphere intersection: solve quadratic |o + td - c|² = r²; two solutions t1,t2 → nearest positive t is hit point; ray-triangle uses Möller-Trumbore algorithm (barycentric coords).\n\nAcceleration structures: BVH (Bounding Volume Hierarchy) — recursively partition scene into axis-aligned bounding boxes; traverse tree, skip subtrees when ray misses AABB; O(log n) avg intersection.\n\nHardware RT: NVIDIA RTX series added dedicated RT Cores for BVH traversal + intersection; DXR/Vulkan RT extensions expose hardware BVH in shaders via TraceRay() / traceRayEXT().\n\nPath tracing: Monte Carlo integration of the rendering equation; trace one random ray per bounce; average thousands of samples per pixel for ground truth; used in offline rendering (Pixar RenderMan, Arnold).\n\nNEE (Next Event Estimation): at each bounce, explicitly sample a random light source to reduce variance vs pure path tracing.\n\nDenoising: NVIDIA DLSS/ NVIDIA AI denoiser, Intel Open Image Denoise — reconstruct clean image from 1-4 spp with temporal accumulation; enables real-time RT at reduced sample counts.',
  },

  bvh_tree_graphics: {
    summary: 'Bounding Volume Hierarchies (BVH) are tree data structures that recursively partition scene geometry into nested axis-aligned bounding boxes, enabling efficient O(log n) ray-intersection tests for ray tracing and collision detection.',
    explanation: 'Construction: sort primitives by centroid along the split axis; split at median (simple) or SAH (Surface Area Heuristic, minimize expected cost = area_L/area_P × N_L + area_R/area_P × N_R).\n\nSAH split: sweep all possible split positions, compute SAH cost, choose minimum; ~5-10× better traversal performance than median split; standard in production renderers.\n\nTraversal: if ray misses node AABB, skip subtree; if leaf, test all contained primitives; push child nodes ordered by near-hit t to traverse near child first.\n\nDynamic BVH: for animated scenes, refitting (update AABB to fit moved primitives without rebuilding topology) is fast but degrades quality; full rebuild or incremental LBVH for real-time.\n\nLinear BVH (LBVH): assign Morton codes (z-order curve) to primitive centroids, sort by Morton code, build BVH bottom-up along sorted order; highly parallelizable on GPU.\n\nTwo-level BVH: top-level over instances, bottom-level per mesh; DXR/Vulkan RT native model; allows animating instances (update transform) without rebuilding bottom-level BVH.\n\nCollision detection: BVH traversal on pairs of BVH trees; narrow phase (exact triangle-triangle test) only after broad phase AABB-AABB miss.',
  },

  pbr_shading: {
    summary: 'Physically Based Rendering (PBR) shading models surface reflectance using physically grounded microfacet theory, enabling consistent material appearance under any lighting. The Cook-Torrance BRDF with Disney\'s reparametrization is the industry standard.',
    explanation: 'BRDF (Bidirectional Reflectance Distribution Function): f(l, v) = ratio of reflected radiance per incoming irradiance; energy conservation: ∫ f(l,v) cos(θ) dl ≤ 1.\n\nMicrofacet model: surface composed of microscopic perfectly specular facets; NDF (Normal Distribution Function) describes facet normal distribution; D(h) — GGX/Trowbridge-Reitz standard.\n\nCook-Torrance BRDF: f_specular = (D·F·G) / (4·(n·l)·(n·v)); D=NDF, F=Fresnel, G=geometry/shadowing-masking term.\n\nFresnel (Schlick approximation): F = F₀ + (1-F₀)·(1-cos θ)⁵; F₀ = reflectance at normal incidence; metals: F₀ ≈ albedo; dielectrics: F₀ ≈ 0.04 (4% reflectance at normal incidence).\n\nDisney PBR parameters: baseColor (albedo), metallic (0=dielectric, 1=conductor), roughness (0=mirror, 1=fully diffuse), normal map — intuitive for artists.\n\nImage-Based Lighting (IBL): pre-filter environment map for diffuse (irradiance convolution) and specular (prefiltered mip chain + BRDF LUT via split-sum approximation); fast and high quality.\n\nDielectrics vs metals: metals have no diffuse, tinted specular (F₀ = baseColor); dielectrics have diffuse + untinted specular; metallic workflow lerps between these.',
  },

  shadow_mapping: {
    summary: 'Shadow mapping renders the scene depth from the light\'s perspective to create a depth map, then tests during main rendering whether each fragment is in shadow by comparing its light-space depth to the stored value.',
    explanation: 'Algorithm: render scene to shadow map (FBO + depth attachment) from light POV; in main pass, transform fragment to light space, compare depth to shadow map sample.\n\nBias: self-shadowing "acne" (fragment shadows itself due to depth precision) fixed by adding a small bias (shadow_bias = 0.005) to sampled depth; too large bias causes "Peter Panning" (shadow detaches from object).\n\nPCF (Percentage Closer Filtering): sample N×N neighborhood of shadow map, average comparison results; soft shadow edges without reconstructing penumbra geometry; standard technique.\n\nPCSS (Percentage Closer Soft Shadows): vary PCF kernel size based on blocker-receiver distance; larger penumbra for distant occluders; more accurate soft shadows.\n\nCSM (Cascaded Shadow Maps): split view frustum into N cascades, use separate shadow map per cascade; near-cascade at high resolution, far at low; transitions between cascades need blending.\n\nVariance Shadow Maps (VSM): store mean and mean-square depth; Chebyshev inequality gives upper bound on shadow probability; GPU-filter-friendly but light bleeding on thin occluders.\n\nRay-traced shadows (RTX): trace shadow ray to light, no bias issues, correct contact shadows, soft shadows via area light sampling — replacing shadow maps in modern pipelines.',
  },

  deferred_rendering: {
    summary: 'Deferred rendering stores geometric properties (position, normal, albedo, roughness) in a Geometry Buffer (G-Buffer) during a first pass, then applies all lighting in screen space in a second pass, decoupling geometry complexity from light count.',
    explanation: 'Forward rendering problem: with M lights and N geometry, naive approach is O(M×N) — each geometry draw must evaluate all lights. With alpha-sorted geometry, forward is still needed.\n\nG-Buffer layout: RT0=albedo+metallic, RT1=worldNormal (2-channel octahedral encoding), RT2=roughness+AO+depth; reconstruct world position from depth + inverse VP matrix.\n\nLighting pass: fullscreen quad; for each pixel, read G-Buffer, evaluate all lights affecting this pixel; point lights: cull by light radius; spot lights: cone test; directional: always.\n\nLight culling: tiled deferred — divide screen into 16×16 tiles, compute min/max depth, build per-tile light list (GPU compute); process only lights intersecting tile.\n\nClustered shading: extend tiling to depth slices (3D clusters); light list per cluster; handles large depth range better than tiled; GPU forward+ rendering uses same culling for forward pass.\n\nTransparency limitation: G-Buffer stores only nearest surface; transparent objects rendered in forward pass after deferred lighting; requires maintaining two render paths.\n\nBandwidth: writing/reading G-Buffer costs bandwidth — MSAA expensive (multiplied G-Buffer size); deferred favored on desktop; tile-based mobile GPUs prefer forward+.',
  },

  pbr_ibl: {
    summary: 'Compute shaders enable general-purpose GPU computation through massively parallel execution of arbitrary code organized in thread groups, enabling GPU-accelerated simulation, physics, image processing, and AI inference beyond the rasterization pipeline.',
    explanation: 'Execution model: compute shader dispatched with (x,y,z) thread groups × (x,y,z) threads per group; total threads = product; SIMD execution in warps/wavefronts of 32/64 threads.\n\nShared memory: fast on-chip memory (SMEM, ~48KB/block) shared within a thread group; used for tile-based algorithms (image filters, reduction); synchronize with GroupMemoryBarrierWithGroupSync().\n\nParallel reduction: sum N values → each thread loads one, reduce half of threads each step in shared memory, O(log N) steps; used for histogram, dot product, prefix sum.\n\nPrefix sum (scan): parallel scan algorithm (Blelloch up/down sweep); result[i] = sum of all elements before i; foundation of GPU sorting (radix sort), stream compaction.\n\nGPU sorting: GPU radix sort (4-bit radix, 8 passes for 32-bit keys); thrust::sort on CUDA; VK_KHR_shader_atomic_int64 for atomic operations; outperforms CPU sort for N > ~1M elements.\n\nAsynchronous compute: dedicated compute queues run compute shaders in parallel with graphics pipeline stages (vertex, rasterization); overlap compute work with rendering to hide latency.\n\nUses: particle simulation (position/velocity update), frustum/occlusion culling, SSAO, depth of field, GPU skinning, neural network inference, physics solver, mipmap generation.',
  },

  vertex_shader_basics: {
    summary: 'Vertex and fragment (pixel) shaders are programmable GPU pipeline stages written in HLSL/GLSL that transform geometry and compute per-pixel colors respectively, providing full control over rendering appearance.',
    explanation: 'Vertex shader input: per-vertex attributes (position, normal, texcoord, tangent) from vertex buffer; uniforms (MVP matrices, time).\n\nMain vertex job: output gl_Position (clip-space position) = projection × view × model × vec4(position, 1.0); pass varyings (interpolated per-fragment values) to fragment stage.\n\nNormal transformation: normals must use inverse-transpose of the model matrix (not model matrix) to remain perpendicular to surface after non-uniform scale.\n\nFragment shader: receives interpolated varyings; outputs final color to render target; discards fragments (alpha cutout); writes to multiple render targets (MRT for G-Buffer).\n\nUniform buffers (UBO/CBUFFER): group frequently updated uniforms (per-frame: VP matrix, lights) into packed GPU memory; avoid individual uniform updates (expensive state changes).\n\nTexture sampling: texture2D(sampler, uv) / texture(sampler2D, uv); mipmapping automatic (lod = log2(dFdx(uv)²+dFdy(uv)²)/2); anisotropic filtering corrects oblique surface aliasing.\n\nDerivatives: dFdx/dFdy give screen-space partial derivatives of any quantity; used for mip-level computation, edge detection, anisotropic filtering; not available in compute shaders.',
  },

  texture_mapping: {
    summary: 'Texture mapping applies 2D images to 3D geometry surfaces via UV coordinates. Advanced techniques include normal mapping, parallax mapping, and atlas packing for high-detail surfaces without additional geometry.',
    explanation: 'UV coordinates: per-vertex (u,v) ∈ [0,1]² map vertex to texture position; interpolated across triangle; UV seams where the mesh "unwraps" flatly.\n\nTexture filtering: nearest (sharp, pixelated), bilinear (2×2 sample average, blurry), trilinear (bilinear between mip levels, no mip transition bands), anisotropic (up to 16× samples along gradient direction for oblique surfaces).\n\nNormal mapping: store per-texel normal perturbation in RGB texture (R=x, G=y, B=z in tangent space); perturb shading normal without adding geometry; TBN matrix (tangent, bitangent, normal) transforms to world space.\n\nParallax mapping: offset UV based on view direction and height map to simulate depth; parallax occlusion mapping (POM) raymarchs height field for accurate self-occlusion at grazing angles.\n\nTexture atlas: pack multiple textures into one large texture; sampled with offset+scale; reduces draw calls (one bind per material set); used in sprite sheets, shadow map cascades.\n\nBC/DXT compression: GPU hardware decompression; BC1 (4:1, RGB+1bit alpha), BC3 (RGB + full alpha), BC7 (high quality), BC6H (HDR float); saves VRAM bandwidth at ~4-6 bpp.\n\nBindless textures (Vulkan/DX12): store 1000s of textures in descriptor heap; shader indexes by uint; eliminates per-draw texture binding; standard in modern AAA rendering.',
  },

  antialiasing_msaa: {
    summary: 'Anti-aliasing removes jagged edges (aliasing) from rendered images by sampling or filtering at sub-pixel frequencies. MSAA, TAA, and DLSS represent successive generations of quality/performance trade-offs.',
    explanation: 'Spatial aliasing: Nyquist theorem violated when a feature smaller than 1 pixel changes; staircase edges on triangles, flickering on thin geometry.\n\nSSAA (Super Sampling): render at 2×/4× resolution, downsample; highest quality, highest cost; O(N²) cost for N× scaling.\n\nMSAA (Multi-Sample Anti-Aliasing): multiple depth/stencil samples per pixel (2×, 4×, 8×), single fragment shader invocation per pixel per primitive; only resolves geometric aliasing (not shader aliasing); GPU-hardware accelerated; 2-4× VRAM cost.\n\nFXAA (Fast Approximate AA): screen-space post-process; detect edges by luma gradient, blur along edge; very fast (single full-screen pass), blurs fine detail.\n\nTAA (Temporal Anti-Aliasing): accumulate samples across frames with sub-pixel jitter; each frame samples different offset; blend with previous frame (exponential moving average); resolves shader aliasing, but causes ghosting artifacts on motion.\n\nDLSS / FSR / XeSS: AI-based/spatial upsampling from lower resolution; DLSS 3 generates full frames with AI; TAA + ML produces cleaner results than native; enabled by temporal signals.\n\nSpecular aliasing: high-frequency specular glints alias temporally; variance-based roughness clamping, LEADR mapping, pre-filtered BRDF address this.',
  },

  global_illumination: {
    summary: 'Global illumination (GI) algorithms simulate indirect light bouncing between surfaces — ambient occlusion, radiosity, path tracing, and real-time probes — producing physically accurate shadows, color bleeding, and ambient light.',
    explanation: 'Rendering equation (Kajiya 1986): L_o(x,ω_o) = L_e(x,ω_o) + ∫_Ω f_r(x,ω_i,ω_o) L_i(x,ω_i) cos(θ_i) dω_i; full GI solves this integral recursively.\n\nAmbient Occlusion: approximate how much ambient light reaches a point; SSAO (screen-space, fast, limited to visible geometry), HBAO+ (horizon-based, higher quality), RTAO (ray-traced AO, RTX).\n\nLightmaps: pre-bake direct + indirect lighting per texel; store in UV-unwrapped lightmap atlas; fast at runtime (texture fetch), but no dynamic objects; Unreal Lightmass, Unity Enlighten.\n\nLight probes: place spherical radiance samples at world positions; interpolate between probes for nearby objects; store as spherical harmonics (9 coefficients for L2 SH) per probe.\n\nLumen (Unreal Engine 5): dynamic GI via screen/mesh distance fields + radiance cache + surface cache; fully dynamic scene changes; software ray marching + hardware RT for final gather.\n\nReSTIR (Reservoir-based Spatiotemporal Importance Resampling): real-time path tracing technique reusing light samples across pixels and frames; enables real-time PT with few samples per pixel.',
  },

  skeletal_animation: {
    summary: 'Skeletal animation deforms mesh vertices by a hierarchy of bones via linear blend skinning (LBS), enabling realistic character motion driven by animator-authored keyframes or physics/inverse kinematics.',
    explanation: 'Skeleton: tree of bones (joints); each bone has local transform (rotation, translation, scale relative to parent) = joint space; global transform = product along chain to root.\n\nRig/binding: skin mesh to skeleton; each vertex has up to 4 bone weights (w_i summing to 1) indicating how much each bone influences it.\n\nLinear Blend Skinning (LBS): vertex_world = Σ_i (w_i × M_bind_i_inv × M_joint_i × vertex_bind); M_bind_i_inv = inverse bind pose matrix (transforms from bind-pose space to bone space).\n\nDual Quaternion Skinning (DQS): avoids "candy wrapper" artifact of LBS (volume loss at joint twists); blend dual quaternions instead of matrices; standard in modern character rendering.\n\nKeyframe interpolation: animator sets keyframes (pose at time t); engine interpolates via LERP (position), SLERP (quaternion rotation), cubic spline (bezier handles for animator control).\n\nInverse Kinematics (IK): solve joint angles to place end-effector (hand, foot) at target position; FABRIK (Forward And Backward Reaching IK), CCD (Cyclic Coordinate Descent), analytical IK for 2-bone chains.\n\nBlend trees: state machine of animation clips; blend between walk/run by speed, aim offset blended on top of locomotion; Unreal AnimGraph, Unity Animator.',
  },

  sdf_rendering: {
    summary: 'Signed Distance Fields (SDFs) represent surfaces as scalar fields where each point stores the signed distance to the nearest surface boundary. They enable smooth rendering, efficient ray marching, and GPU font rendering.',
    explanation: 'SDF definition: f(p) = d where d < 0 inside surface, d > 0 outside, d = 0 on surface; gradient magnitude = 1 (Eikonal equation) for true SDF.\n\nRay marching: start at ray origin; advance by f(p) (safe step without overshooting surface); converge to surface where f(p) < ε in O(steps) vs O(1) analytical intersection; Sphere Tracing (Hart 1996).\n\nCSG operations on SDFs: union = min(d_A, d_B), intersection = max(d_A, d_B), subtraction = max(d_A, -d_B); smooth blend with smoothmin = -log(e^(-k×d_A) + e^(-k×d_B))/k.\n\nGPU font rendering: multi-channel SDF (MSDF) stores per-channel SDF for different edge directions; enables sharp corners at any scale from single low-resolution texture; standard in game engines (Three.js, Unity UGUI).\n\nMesh SDF generation: voxelize mesh, compute closest surface point per voxel, sign via winding number or ray cast; store as 3D texture; Unreal Engine uses mesh SDFs for Lumen GI.\n\nWorld SDF: Lumen/Cascades store scene-level SDF in 3D texture clipmaps around camera; ray march against scene SDF for AO, GI rays, reflections at low cost.',
  },

  lod_technique: {
    summary: 'Level of Detail (LOD) techniques reduce rendering cost for distant or less important objects by substituting high-complexity representations with simpler geometry or billboard proxies, maintaining visual quality at reduced compute cost.',
    explanation: 'Discrete LOD: artist-authored or auto-generated mesh simplifications (LOD0=full, LOD1=50%, LOD2=25%,...); select based on screen coverage (projected bounding sphere radius in pixels).\n\nMesh simplification: edge collapse (QEM — Garland-Heckbert Quadric Error Metrics); minimize visual error while halving triangle count; MeshOptimizer library, UE/Unity built-in LOD generation.\n\nBillboard/Impostor: replace distant tree/building with textured quad always facing camera; pre-render multiple angles into impostor atlas for parallax correction; Octahedral impostor captures full sphere.\n\nNanite (UE5): virtual geometry; cluster-based streaming LOD system; hardware rasterization for macro geometry, software rasterization for micropolygon clusters; every mesh at full authoring quality, GPU selects visible clusters per frame.\n\nTerrain LOD: Geoclipmap / CDLOD (Continuous Distance-Dependent Level of Detail); concentric rings of increasing resolution around camera; morph vertices at LOD transition to avoid popping.\n\nHierarchical LOD (HLOD): merge distant instances into single draw call (merged mesh + single texture atlas); drastically reduces draw calls for large open worlds; UE World Partition HLODs.\n\nOcclusion culling: Hi-Z occlusion buffer (hierarchical depth test on GPU); CPU-side occlusion culling (PVS precomputation, portal culling); skip rendering entirely before LOD selection.',
  },

// ── PROGRAMMING LANGUAGES ─────────────────────────────────────

  lambda_calculus_pl: {
    summary: 'Lambda calculus is the minimal formal system underlying all functional programming languages, built from three constructs: variable reference, function abstraction, and function application.',
    explanation: 'Syntax: e ::= x | λx.e | e e; Abstraction λx.e binds x in body e; Application e1 e2 applies e1 to argument e2.\n\nBeta reduction: (λx.e1) e2 → e1[e2/x] — substitute e2 for all free occurrences of x in e1; the core computation rule.\n\nAlpha equivalence: λx.x ≡ λy.y (variable names are irrelevant); avoid variable capture during substitution by alpha-renaming bound variables.\n\nChurch encodings: booleans (true = λt.λf.t), natural numbers (n = λs.λz.s^n(z)), pairs, lists — proof that λ-calculus is Turing complete.\n\nNormal order vs applicative order: normal order (leftmost outermost redex first) always terminates if any reduction terminates; applicative order (evaluate arguments first, like most languages) may diverge (Ω combinator).\n\nSimply typed lambda calculus (STLC): assign types to prevent divergence; type checking decidable; not Turing complete (can\'t express all computations).\n\nSystem F (polymorphic λ): adds universal quantification ∀α.T; ∀α.α→α (polymorphic identity); foundation of Haskell/ML polymorphism (rank-1 = Hindley-Milner).',
  },

  type_inference_hindley: {
    summary: 'Hindley-Milner type inference automatically deduces types for all expressions in a polymorphic functional program without annotations. The Algorithm W (Robinson unification + let-generalization) runs in nearly linear time.',
    explanation: 'Unification: given two type expressions τ1, τ2, find substitution S such that S(τ1) = S(τ2); most general unifier (MGU) is unique up to renaming; Robinson\'s algorithm.\n\nAlgorithm W: W(Γ, e) → (S, τ) where Γ is type environment:\n  var x: return (∅, Γ(x) with fresh type vars for quantified vars)\n  abs λx.e: fresh α, W(Γ+{x:α}, e) → (S,τ), return (S, Sα→τ)\n  app e1 e2: W(Γ,e1)→(S1,τ1), W(S1Γ,e2)→(S2,τ2); unify S2τ1 with τ2→fresh β; return (S3∘S2∘S1, S3 β)\n\nLet-polymorphism: let x = e1 in e2 — generalize free type vars in type of e1 not free in Γ; allows different instantiations of x in e2.\n\nValue restriction (ML): only generalize let-bound values (not expressions with side effects) to prevent unsound polymorphism with mutable references.\n\nGADTs and rank-N: Haskell extends HM with higher-rank types (∀ in argument positions), GADTs (refined return types); require type annotations, inference becomes undecidable in general.\n\nBidirectional typing: check mode (expression against known type) + infer mode; practical for languages with subtyping and dependent types where full inference is undecidable.',
  },

  monads_functors: {
    summary: 'Functors, applicatives, and monads are typeclass abstractions from category theory that structure effectful computations (IO, state, error handling) in a composable, type-safe way in functional languages.',
    explanation: 'Functor: typeclass with fmap :: (a → b) → f a → f b; laws: fmap id = id, fmap (f∘g) = fmap f ∘ fmap g; examples: Maybe, List, IO, Either.\n\nApplicative: extends Functor with pure :: a → f a and (<*>) :: f (a→b) → f a → f b; enables parallel independent effects (no data dependency); sequencing vs parallelism.\n\nMonad: extends Applicative with (>>=) :: m a → (a → m b) → m b (bind); enables sequencing where each step depends on previous value; Monad laws: left/right identity, associativity.\n\nCommon monads: Maybe (failure), Either e (errors with context), IO (impure effects), State s (threading state), Reader r (read-only environment), Writer w (accumulate output), List (non-determinism).\n\ndo-notation: syntactic sugar for bind: "x ← action; rest" desugars to "action >>= (\\x → rest)"; makes sequential monadic code readable.\n\nMonad transformers: StateT, ReaderT, ExceptT stack monadic effects; mtl library provides classes (MonadState, MonadError) for polymorphic effect handling; avoid N×M transformer instances with tagless final.\n\nCategory theory origin: monad = monoid in the category of endofunctors; not necessary to understand category theory to use monads effectively.',
  },

  ownership_borrowing_rust: {
    summary: 'Rust\'s ownership system enforces memory safety and data-race freedom at compile time through three rules: each value has one owner, ownership transfers on move, and borrows must not outlive their owner.',
    explanation: 'Ownership rules: each value has exactly one owner; when owner goes out of scope, value is dropped (destructor called, memory freed); no garbage collector needed.\n\nMove semantics: assignment transfers ownership (let s2 = s1; s1 is invalid); types implementing Copy (integers, bool) are bitwise copied instead.\n\nBorrowing: &T (shared/immutable reference) — many allowed simultaneously; &mut T (exclusive/mutable reference) — only one at a time; no reference can outlive the owner.\n\nBorrow checker: static analysis ensures: no use-after-free (reference must be valid), no double-free (owner frees once), no data races (exclusive or shared access, never both simultaneously).\n\nLifetimes: explicit annotations \'a describe how long references are valid; usually inferred via lifetime elision rules; necessary when struct holds references.\n\nSmart pointers: Box<T> (heap allocation, single owner), Rc<T>/Arc<T> (reference counting, shared ownership), RefCell<T> (interior mutability, runtime borrow checking).\n\nUnsafe: `unsafe` block allows raw pointers, FFI, unchecked ops; safety invariants maintained by programmer; isolates unsafe code for auditing.',
  },

  actor_model_pl: {
    summary: 'The actor model is a concurrency paradigm where computation is performed by isolated actors communicating exclusively via asynchronous message passing, eliminating shared mutable state and data races.',
    explanation: 'Actor primitives: an actor has private state, a mailbox (message queue), and a behavior (message handler); actors can create new actors, send messages, and update behavior upon receiving a message.\n\nNo shared memory: actors communicate only via messages; no locks required; eliminates data races by design; location transparency (actors can be on different machines).\n\nErlang/OTP: actors = processes (very lightweight, ~300 bytes stack); spawn/!, receive; supervisor trees (each actor supervised, restarted on crash — "let it crash" philosophy); hot code reload.\n\nAkka (JVM): Actor, ActorContext, ask/tell patterns; supervision strategies (restart, resume, stop, escalate); router pools for load distribution; Akka Cluster for distribution.\n\nFault tolerance: supervisors monitor child actors; on failure, apply supervision strategy; error isolation prevents cascading failures (unlike shared-memory threads).\n\nBackpressure: mailbox overflow signals overload; bounded mailboxes apply backpressure; circuit breakers at actor level; monitoring via dead letters (undeliverable messages).\n\nVirtualization: Akka Virtual Actors (Orleans "grains"), Microsoft Orleans — actors automatically activated on demand, deactivated when idle; sharded across cluster automatically.',
  },

  algebraic_data_types: {
    summary: 'Algebraic Data Types (ADTs) — sum types (OR) and product types (AND) — provide a composable type algebra for modeling domain data with exhaustive pattern matching enforced by the compiler.',
    explanation: 'Product type (struct/record): Cart of (id: Int, items: [Item], total: Float) — holds all components simultaneously; n * m possible values (product of component cardinalities).\n\nSum type (enum/variant): Shape = Circle(radius: Float) | Rectangle(width: Float, height: Float) | Triangle(...) — holds exactly one variant; n + m possible values.\n\nOption/Maybe: data Maybe a = Nothing | Just a; eliminates null pointer errors (null is modeled explicitly as Nothing); type system forces caller to handle both cases.\n\nResult/Either: data Either e a = Left e | Right a; encode success/failure in type; cannot ignore error case; Rust Result<T, E> standard for all fallible ops.\n\nPattern matching: case shape of Circle r → πr², Rectangle w h → w×h; exhaustiveness checking: compiler errors if case is unhandled; deconstruct nested patterns.\n\nRecursive ADTs: data List a = Nil | Cons a (List a); data Tree a = Leaf | Node (Tree a) a (Tree a); natural fit for tree traversal algorithms.\n\nPhantom types: type-level tags that carry no runtime data; enforce state machine transitions (Locked vs Unlocked door), units (Meters vs Feet), validated vs unvalidated data.',
  },

  coroutines_pl: {
    summary: 'Coroutines are generalized subroutines that can suspend and resume execution at defined suspension points, enabling cooperative concurrency, async I/O, and generator patterns without OS thread overhead.',
    explanation: 'Stackful vs stackless: stackful coroutines (goroutines, Kotlin coroutines) have their own stack, can suspend from deep call; stackless (async/await in C++/Rust/JS) only suspend at top level, compiled to state machine.\n\nAsync/await: syntactic sugar over state machine; each await point is a state; on suspension, return future/promise to caller; resumed by scheduler when I/O completes.\n\nKotlin Coroutines: suspend functions; CoroutineScope + launch/async builders; Dispatchers (IO, Default, Main); structured concurrency: scope cancels all children on cancel.\n\nGoroutines (Go): green threads, 2KB initial stack, multiplexed on OS threads by GOMAXPROCS scheduler (M:N threading); channel communication; select for multi-channel fan-in.\n\nPython asyncio: event loop; async def / await; coroutines are first-class; asyncio.gather for concurrent tasks; limitations: single-threaded (GIL), can\'t mix sync/async.\n\nGenerator pattern: yield suspends coroutine, returns value to caller; caller resumes with send(value); infinite sequences, lazy pipelines; Python generators, C# IEnumerable.\n\nStructured concurrency: scope-based lifetime for concurrent tasks; all tasks complete/cancel before scope exits; avoids leaked goroutines/tasks; Kotlin structured concurrency, Swift TaskGroup.',
  },

  dependent_types_pl: {
    summary: 'Dependent type systems allow types to depend on values, enabling proofs of program correctness to be expressed as types. Languages like Agda, Idris, and Lean use dependent types for verified software and mathematical proofs.',
    explanation: 'Dependent function type Π: (x : A) → B(x) — type of result depends on value of argument; e.g., Vec : ℕ → Type (vector of length n has different type for each n).\n\nDependent pair type Σ: (x : A) × B(x) — value is a pair where type of second component depends on value of first; models "there exists x such that P(x)".\n\nCurry-Howard isomorphism: propositions are types, proofs are programs; P ∧ Q = A × B (product), P ∨ Q = A + B (sum), P → Q = A → B (function), ¬P = A → ⊥ (empty type).\n\nVector example: Vec A n = list of length n in the type; head : Vec A (n+1) → A — statically prevents head of empty list.\n\nAgda/Idris: total languages (all functions terminate); pattern matching with dependent elimination; Idris allows holes (typed program development), erasure of proof terms at runtime.\n\nLean 4: interactive theorem prover + programming language; mathlib contains thousands of formalized proofs; tactics (ring, simp, omega) automate proof steps.\n\nLimitations: decidable type checking requires type normalization (termination checking); higher-order unification for implicit arguments undecidable; verbose proofs for real programs.',
  },

  metaprogramming: {
    summary: 'Metaprogramming enables programs to treat code as data — generating, transforming, or analyzing programs at compile time (macros, template metaprogramming) or runtime (reflection, code generation) to reduce boilerplate.',
    explanation: 'Hygienic macros (Rust proc-macros, Racket): macro-generated identifiers are in separate scope from call site; prevents accidental variable capture; AST → AST transformation.\n\nRust procedural macros: derive macros (auto-implement traits: #[derive(Debug, Serialize)]), attribute macros (#[tokio::main]), function-like macros (vec![1,2,3]); operate on TokenStream.\n\nC++ template metaprogramming: templates as compile-time functions; template specialization for type-based dispatch; constexpr for compile-time computation; concepts (C++20) for readable constraints.\n\nReflection (Java, C#, Python): inspect type metadata at runtime (class name, fields, methods, annotations); dynamic instantiation and method invocation; used by ORMs, DI containers, serialization frameworks.\n\nCode generation: generate code from schemas (OpenAPI → client stubs, Protobuf → serialization code, GraphQL → type-safe resolvers); reduces hand-maintenance.\n\nLisp macros: homoiconic — code is data (S-expressions); macro transforms S-expression at read time; most powerful macro system; build domain languages (DSLs) transparently.\n\nStaged metaprogramming (MetaML, Scala 3 macros): explicit staging annotations; code generated at compile time with type safety; multi-stage programming for specialization.',
  },

  memory_safety_pl: {
    summary: 'Memory safety prevents undefined behavior from invalid memory accesses — use-after-free, buffer overflows, null dereferences, double-free. Languages achieve it via garbage collection, ownership systems, or bounds checking.',
    explanation: 'Memory safety violations: use-after-free (access freed memory), buffer overflow (write past array end → overwrite adjacent data), null dereference (deref null pointer), double-free (free same allocation twice), data race (concurrent unsynchronized write).\n\nGarbage collection: trace live objects from roots, reclaim unreachable memory; tracing GC (Mark-and-Sweep, Tri-color, Incremental), generational GC (young/old generation), concurrent GC (G1, ZGC minimize pause).\n\nRust ownership: compile-time single-owner + borrow rules; no GC, no runtime overhead; use-after-free and double-free impossible; ~15ms pause eliminated vs GC languages.\n\nSafe C++: unique_ptr/shared_ptr prevent leaks and double-free; span for bounds checking; std::variant eliminates union misuse; sanitizers (AddressSanitizer, UBSan) detect violations at runtime.\n\nBounds checking: array access arr[i] compiles with check (i < len); Java ArrayIndexOutOfBoundsException; Rust panics; C++ std::vector::at() throws; eliminates exploitation of buffer overflows.\n\nValgrind / ASan: dynamic analysis tools that intercept memory operations; Valgrind instruments IR; ASan uses shadow memory and redzones; detect use-after-free, overflow, leaks at 2-10× overhead.\n\nCFI (Control Flow Integrity): compiler-inserted checks on indirect calls/jumps; prevents ROP chain exploitation; LLVM CFI, Microsoft Control Flow Guard.',
  },

  concurrent_primitives_pl: {
    summary: 'Concurrent programming primitives — mutexes, condition variables, semaphores, channels, atomic operations — coordinate shared state access and thread synchronization, preventing data races and deadlocks.',
    explanation: 'Mutex (Mutual Exclusion): lock before accessing critical section, unlock after; spinlock (busy-wait, CPU-burn, good for short critical sections), OS mutex (syscall, thread sleeps, good for long waits).\n\nCondition variable: allows thread to sleep until condition becomes true; pair with mutex: lock → check condition → if false, cond_wait (atomically releases lock and sleeps) → woken by cond_signal.\n\nSemaphore: counter generalization of mutex; counting semaphore (controls access to N resources), binary semaphore (mutex replacement); P(decrement, wait if 0), V(increment, signal).\n\nRead-Write lock: multiple readers OR one writer; shared acquisition for reads, exclusive for writes; improves throughput for read-heavy workloads; writer starvation possible.\n\nAtomic operations: compare-and-swap (CAS), fetch-and-add; hardware-atomic (single bus transaction); memory ordering: relaxed, acquire, release, seq_cst (total order); foundation of lock-free data structures.\n\nChannels (Go, Rust): typed message queues; buffered (non-blocking until full) vs unbuffered (rendezvous, sender blocks until receiver ready); go select multiplexes multiple channels.\n\nDeadlock prevention: lock ordering (always acquire locks in same order), lock timeout, deadlock detection (resource allocation graph cycle), lockless algorithms.',
  },

  linear_types: {
    summary: 'Linear types ensure each value is used exactly once, enabling compile-time resource management (file handles, network connections, memory) without garbage collection and making resource leaks and double-use impossible.',
    explanation: 'Linear logic (Girard 1987): propositions as resources consumed exactly once; contrasts with intuitionistic logic where propositions can be used any number of times.\n\nLinear type rule: if Γ ⊢ t : T (T is linear), T must appear exactly once in every execution path; branching requires copy or explicit split.\n\nResource management: file handle : Linear File — must be closed exactly once; type checker prevents forgetting to close (leak) or closing twice (double-free); no runtime checks needed.\n\nRust affine types: Rust uses affine types (use at most once); values moved on use; can drop (use zero times) but not clone implicitly; strictly weaker than linear (linear = exactly once).\n\nSession types: encode communication protocols in types; each send/receive changes session type; ensures protocol adherence without runtime checks; bidirectional linear channels.\n\nUnique types (Clean language): uniqueness instead of linearity; a unique value has exactly one reference, enabling in-place update without copying (unique arrays updated destructively).\n\nLinear Haskell (GHC extension): linear types via (→.) annotation; f : a →. b means f uses its argument exactly once; enables safe mutable arrays (alloc → write* → read → free).',
  },

// ── ADVANCED NETWORKING ───────────────────────────────────────

  software_defined_networking: {
    summary: 'Software-Defined Networking (SDN) separates the network control plane (routing logic) from the data plane (packet forwarding), centralizing control in a software controller that programs network devices via APIs like OpenFlow.',
    explanation: 'Control plane: decides where packets go (routing algorithms, policy); traditionally distributed across routers via BGP/OSPF.\n\nData plane (forwarding plane): executes forwarding decisions; match-action tables (OpenFlow flow table: match on dst IP/port → action: forward/drop/rewrite).\n\nOpenFlow: standard protocol between SDN controller and switches; controller installs flow rules; switch forwards by matching rules; proactive vs reactive (controller consulted per-flow) installation.\n\nSDN Controller: OpenDaylight, ONOS, Ryu; northbound API to applications (REST/gRPC); southbound API to devices (OpenFlow, NETCONF, gNMI); centralized view enables traffic engineering.\n\nNetwork Function Virtualization (NFV): replace dedicated appliances (firewall, load balancer, IDS) with software on commodity servers; VNF (Virtual Network Function) chains.\n\nBenefits: dynamic traffic engineering, A/B testing network configs, rapid policy change, programmable WAN (SD-WAN); used by Google B4 (WAN traffic engineering), Facebook Fabric.\n\nP4 (Programming Protocol-Independent Packet Processors): data plane programming language; define parser, match-action table layout; compiled to ASIC/FPGA/smartNIC; more flexible than OpenFlow.',
  },

  network_virtualization_vxlan: {
    summary: 'VXLAN (Virtual Extensible LAN) overlays Layer 2 Ethernet frames over Layer 3 UDP networks, enabling multi-tenant network virtualization in cloud environments by encapsulating tenant traffic in UDP datagrams.',
    explanation: 'Problem: cloud multi-tenancy needs tenant-isolated L2 domains; VLAN limit of 4094 insufficient for hyperscale; VXLAN provides 16M segments (24-bit VNI).\n\nEncapsulation: inner Ethernet frame + VXLAN header (VNI) wrapped in UDP (dst 4789) + outer IP; VTEP (VXLAN Tunnel End Point) encapsulates/decapsulates on each host.\n\nVTEP learning: flood-and-learn (initial packet flooded to all VTEPs, VTEP learns MAC→VTEP mapping) or control-plane distributed (BGP EVPN distributes MAC/IP routes — preferred at scale).\n\nBGP EVPN: RFC 7432 type-2 routes carry MAC+IP→VTEP binding; type-5 for IP prefix routes; enables distributed routing with ARP suppression (VTEP answers ARP locally using learned bindings).\n\nKubernetes networking (Flannel/Calico VXLAN): each node is VTEP; pod CIDR per node; pod traffic VXLAN encapsulated between nodes; Calico can use BGP peer-to-peer instead for performance.\n\nGeneve vs VXLAN: Geneve is the next-generation overlay; variable-length header with extensible options; OVN (Open Virtual Network) uses Geneve; VXLAN remains dominant for compatibility.\n\nSmart NIC offload: hardware VTEP on NIC (NVIDIA BlueField, Intel IPU); kernel bypass (DPDK/XDP) for high-throughput VXLAN without CPU involvement.',
  },


  quic_protocol: {
    summary: 'QUIC is a multiplexed transport protocol over UDP developed by Google and standardized as RFC 9000, providing TLS 1.3 security, stream multiplexing without head-of-line blocking, and 0-RTT connection resumption. HTTP/3 runs over QUIC.',
    explanation: 'Motivation: TCP has fundamental limitations — head-of-line blocking (one lost packet stalls all streams), slow handshake (1.5 RTT TCP + 1 RTT TLS), no connection migration on IP change.\n\nQUIC streams: multiple independent byte streams per connection; loss of one stream\'s packet only blocks that stream, not others (eliminates HoL blocking); QUIC over UDP at application layer.\n\nHandshake: 1 RTT for new connections (QUIC + TLS 1.3 combined), 0 RTT for resumption (session ticket + early data); faster initial page load vs TCP+TLS (3+ RTT).\n\nConnection migration: connection identified by Connection ID (not 4-tuple); mobile client switching from WiFi to LTE continues session without reconnect; connection ID rotation for privacy.\n\nPacket number spaces: Initial, Handshake, Application Data; each encrypted independently; ACKs cannot be forged; AEAD (AES-GCM or ChaCha20-Poly1305) encrypts all QUIC packets including headers.\n\nCongestion control: pluggable (CUBIC default, BBR available); per-connection not per-stream; QUIC ACK frequency negotiation; ECN (Explicit Congestion Notification) support.\n\nHTTP/3: QUIC streams as HTTP streams; QPACK for header compression (HPACK not suitable due to per-stream ordering); server push over QUIC; implemented in nginx, Caddy, Cloudflare.',
  },

  multicast_routing: {
    summary: 'IP multicast delivers packets to multiple receivers using a single network copy (replicated only at distribution points), enabling efficient one-to-many streaming, video conferencing, and financial market data distribution.',
    explanation: 'Problem: unicast sends N copies for N receivers (wasting sender bandwidth); broadcast floods all hosts; multicast sends once, network replicates only at branches.\n\nClass D addresses: 224.0.0.0/4 for IPv4 multicast; IANA assignments: 224.0.0.1 (all hosts), 224.0.0.2 (all routers), 232.0.0.0/8 (SSM), 239.0.0.0/8 (org-local scope).\n\nIGMP (Internet Group Management Protocol): hosts join/leave multicast groups via IGMP reports to last-hop router; IGMPv3 adds source filtering (SSM — Source-Specific Multicast).\n\nPIM (Protocol Independent Multicast): routing protocol between multicast routers; PIM-SM (Sparse Mode): default uses RP (Rendezvous Point) as meeting point for sources and receivers, switches to SPT (Shortest Path Tree) for efficiency.\n\nPIM-SSM (Source-Specific Multicast): receiver specifies exact source; no RP needed; more scalable and secure; directly builds SPT; preferred for inter-domain multicast.\n\nMLD (Multicast Listener Discovery): IPv6 equivalent of IGMP; MLD Snooping in L2 switches limits multicast to interested ports only (vs flooding).\n\nApplications: IPTV, financial tick data (NYSE/NASDAQ multicast feeds), real-time gaming state sync, software distribution (PXE multicast OS deployment).',
  },

  wireless_80211_wifi: {
    summary: 'IEEE 802.11 (WiFi) standards define wireless LAN protocols using CSMA/CA medium access, OFDM/OFDMA modulation, and multiple spatial streams (MIMO) for high-throughput wireless networking from 802.11a through Wi-Fi 7.',
    explanation: 'CSMA/CA (Carrier Sense Multiple Access / Collision Avoidance): listen before transmit; if medium busy, back off random interval (exponential backoff); ACK required for each frame (unlike Ethernet CSMA/CD).\n\nOFDM (Orthogonal Frequency Division Multiplexing): split channel into parallel subcarriers (52 in 802.11a); QAM modulation per subcarrier (BPSK/QPSK/16-QAM/64-QAM/256-QAM/1024-QAM); guard interval prevents ISI.\n\nMIMO: multiple antennas on TX and RX; spatial streams send independent data streams simultaneously; 802.11n: 4×4 MIMO, 4 streams; beamforming focuses energy toward client; MU-MIMO (802.11ac) serves multiple clients.\n\nGeneration comparison: 802.11n (Wi-Fi 4, 2.4/5GHz, 600Mbps), 802.11ac (Wi-Fi 5, 5GHz, 3.5Gbps MU-MIMO), 802.11ax (Wi-Fi 6, OFDMA for dense environments, 9.6Gbps, TWT for IoT battery), Wi-Fi 7 (802.11be, 46Gbps, 320MHz channels, Multi-Link Operation).\n\nOFDMA (Wi-Fi 6): divide channel into Resource Units (subcarrier groups) allocated to different users simultaneously; dramatically improves efficiency in dense deployments (airports, stadiums).\n\nSecurity: WPA3-SAE (Simultaneous Authentication of Equals) replaces PSK; PMKSA caching, OWE (Opportunistic Wireless Encryption) for open networks; MFP (Management Frame Protection) prevents deauth attacks.',
  },

  network_security_firewall: {
    summary: 'Firewalls filter network traffic based on rules, providing access control between network segments. Next-generation firewalls (NGFW) add application-layer inspection, IPS, and TLS decryption beyond traditional port/protocol filtering.',
    explanation: 'Packet filter (L3/L4): match on src/dst IP, protocol, port; stateless (checks each packet independently, allows responses separately); iptables FILTER table (INPUT/OUTPUT/FORWARD chains).\n\nStateful firewall: tracks connection state (NEW, ESTABLISHED, RELATED); allows return packets automatically; iptables conntrack (-m state --state ESTABLISHED,RELATED -j ACCEPT).\n\niptables architecture: tables (filter, nat, mangle, raw), chains (PREROUTING, FORWARD, POSTROUTING, INPUT, OUTPUT), rules (match + target); nftables modern replacement with unified syntax.\n\nNGFW (Next-Generation Firewall): L7 application identification (BitTorrent, Office 365) regardless of port; IPS inline signature matching; TLS inspection (intercept, decrypt, inspect, re-encrypt); URL filtering; user identity mapping.\n\nNetwork segmentation: DMZ (web servers public-facing, DB servers internal only); microsegmentation in cloud (security groups, VPC ACLs); zero trust = deny-all default, explicit allow.\n\nWAF (Web Application Firewall): L7 HTTP inspection; OWASP ModSecurity Core Rule Set; detect SQLi, XSS, LFI; deployed before web servers (CloudFront WAF, AWS WAF, nginx ModSecurity).\n\nDPI (Deep Packet Inspection): inspect payload content; used for DLP (Data Loss Prevention), content filtering, QoS marking; performance-intensive at line rate.',
  },

  load_balancer_l4_l7: {
    summary: 'Load balancers distribute incoming traffic across backend servers for scalability and availability. Layer 4 (TCP/UDP) balancers forward by connection, while Layer 7 (HTTP) balancers inspect application content for intelligent routing.',
    explanation: 'L4 load balancer: operates at TCP/UDP layer; forwards connections by 5-tuple; NAT mode (rewrite dst IP/port), DSR mode (server responds directly to client — higher throughput); no content inspection; very low latency.\n\nL7 load balancer: terminates TCP+TLS; inspects HTTP headers, path, cookies; route /api to API servers, /static to CDN; host-based routing (multiple domains); sticky sessions (by cookie or src IP hash).\n\nAlgorithms: Round Robin (sequential), Least Connections (route to server with fewest active), Weighted (capacity-proportional), IP Hash (consistent client→server mapping), Random with Power of Two Choices.\n\nNGINX: event-driven, async; upstream block defines backends; proxy_pass; health checks (active: periodic probe, passive: mark down on errors); SSL termination; rate limiting (limit_req_zone).\n\nHAProxy: high performance TCP/HTTP; ACL-based routing; stats page; PROXY protocol passes client IP through L4 to L7; used by many cloud providers as backend.\n\nKubernetes Service types: ClusterIP (internal), NodePort, LoadBalancer (provisions cloud LB); Ingress controller (nginx-ingress, Traefik) provides L7 routing rules; Gateway API is the modern replacement for Ingress.\n\nGlobal Load Balancing: Anycast routing (same IP announced from multiple PoPs, BGP routes client to nearest); AWS Global Accelerator, Cloudflare Anycast; latency-based DNS routing (Route 53).',
  },

// ── CLOUD & DEVOPS (continued) ────────────────────────────────

  cloud_storage_s3: {
    summary: 'Amazon S3 and object storage systems provide virtually unlimited, durable key-value blob storage accessible over HTTP. Object storage underpins data lakes, backups, static website hosting, and ML dataset storage at exabyte scale.',
    explanation: 'Object model: object = key + data + metadata; flat namespace within a bucket; no directory hierarchy (simulated via key prefix); max object size 5TB (multipart upload required >5GB).\n\nDurability model: S3 Standard achieves 99.999999999% (11 nines) durability via erasure coding across ≥3 AZs; versioning maintains object history; MFA Delete prevents accidental deletion.\n\nStorage classes: Standard (frequent access), Intelligent-Tiering (auto moves between tiers), Standard-IA (infrequent access, lower cost + retrieval fee), Glacier Instant/Flexible/Deep Archive (archival, minutes/hours/12h retrieval).\n\nAccess patterns: pre-signed URLs (time-limited access without credentials), S3 Transfer Acceleration (CloudFront edge upload), S3 Multipart Upload (parallel parts, required >100MB).\n\nConsistency model: S3 provides strong read-after-write consistency for all operations since December 2020 (previously eventual for overwrite/delete).\n\nEvent notifications: S3 → SNS/SQS/Lambda on PUT/DELETE; S3 Batch Operations processes billions of objects; S3 Inventory lists objects for audit/compliance.\n\nGCS (Google Cloud Storage) and Azure Blob Storage provide equivalent functionality; MinIO is self-hosted S3-compatible object storage for on-premise.',
  },

  cloud_iam_rbac: {
    summary: 'Cloud IAM (Identity and Access Management) controls who can do what on which resources through policies attached to principals (users, groups, service accounts, roles), implementing least-privilege access control at cloud scale.',
    explanation: 'AWS IAM model: principal (user/role/service) + action (s3:GetObject) + resource (arn:aws:s3:::bucket/*) + conditions (IP, MFA, time); Allow/Deny effect; explicit Deny always wins.\n\nPolicy types: Identity-based (attached to principal, defines what they can do), Resource-based (attached to resource, defines who can access it — S3 bucket policy, KMS key policy), Permission boundaries (maximum permission ceiling).\n\nIAM Roles: assume-able by principals via STS AssumeRole; temporary credentials (15min-12h); EC2 instance profiles auto-refresh credentials; cross-account access via role assumption.\n\nLeast privilege: start with no permissions, add only required; use IAM Access Analyzer to identify unused permissions; periodic access reviews; just-in-time access (Vault, PIM).\n\nService accounts (GCP / Kubernetes): GCP Workload Identity Federation allows K8s pods to assume GCP service accounts via OIDC token exchange without storing keys.\n\nAWS Organizations SCPs (Service Control Policies): preventive guardrails applied at account/OU level; even account root cannot exceed SCP; enforce region restrictions, deny disable-CloudTrail.\n\nAWSconfig + CloudTrail: every API call logged in CloudTrail; Config tracks resource configuration history and compliance (config rules); IAM Credential Report audits all credential ages.',
  },

  cdn_edge_delivery: {
    summary: 'Content Delivery Networks (CDNs) cache content at globally distributed Points of Presence (PoPs) close to users, reducing latency, offloading origin servers, and providing DDoS protection through scale and anycast routing.',
    explanation: 'CDN mechanics: user DNS resolves to nearest PoP IP (GeoDNS or Anycast); cache HIT returns content from PoP (~5ms); cache MISS fetches from origin, caches for TTL, subsequent requests served from cache.\n\nCache key: by default URL; vary by Accept-Encoding (gzip vs br), Cookie (authenticated vs anonymous), Accept-Language; cache-control headers control TTL: max-age, s-maxage, no-cache, no-store.\n\nCloudFront: AWS CDN; distributions backed by S3/ALB/custom origin; edge caching + Lambda@Edge (Node.js functions at edge for auth, A/B testing, URL rewrite); Functions (lightweight JS) for header manipulation.\n\nCache invalidation: TTL expiry (passive), explicit invalidation (CloudFront CreateInvalidation, costly per 1000 paths), cache versioning (append content hash to filename — far-future TTL).\n\nDynamic acceleration: CDN maintains persistent connections to origin, TCP optimizations, protocol upgrade (HTTP/2, HTTP/3 to edge); reduces round trips for dynamic content.\n\nDDoS protection: CDN absorbs volumetric attacks (10-100 Tbps scrubbing capacity); Cloudflare, Akamai, AWS Shield Advanced; rate limiting at edge; bot management (JS challenge, CAPTCHAs).\n\nEdge computing: Cloudflare Workers, Fastly Compute@Edge, Lambda@Edge run code at PoP; personalization, auth, A/B testing without hitting origin; V8 isolates for sub-millisecond cold start.',
  },

// ── COMPUTER GRAPHICS (continued) ────────────────────────────

  compute_shaders_gfx: {
    summary: 'Compute shaders run general-purpose code on the GPU outside the fixed rasterization pipeline, enabling physics simulation, particle systems, culling, and post-processing through massively parallel GPGPU execution.',
    explanation: 'Execution model: dispatched with thread group dimensions (vkCmdDispatch / DispatchThreads); each group runs in parallel; threads within a group share group-shared memory (HLSL: groupshared, GLSL: shared).\n\nThread group size: typically 64 or 256 threads per group (warp/wavefront aligned); choose power-of-2; occupancy balances register usage vs active warps.\n\nParallel reduction: sum N values across threads using shared memory; O(log N) steps in group; then one thread writes group result; used for histogram, min/max, dot product.\n\nGPU particle systems: update positions/velocities in compute shader (no CPU readback); append/consume structured buffers for indirect particle emission; instanced rendering with indirect draw.\n\nHi-Z occlusion culling: generate hierarchical depth buffer from previous frame Z; compute shader tests bounding boxes against Hi-Z — reject occluded draw calls before GPU touch them.\n\nAsynchronous compute: compute queue runs parallel to 3D queue; overlap shadow map rendering (3D) with particle simulation (compute); hide latency of non-dependent GPU work.\n\nMesh shaders (DX12U/Vulkan): replace vertex+geometry pipeline; compute-like amplification shader (coarse culling) + mesh shader (emit optimized mesh); Nanite relies on mesh shaders for micro-polygon rendering.',
  },

  volumetric_rendering: {
    summary: 'Volumetric rendering simulates light interaction with participating media — fog, clouds, smoke, fire — by modeling scattering and absorption as light passes through volumetric densities rather than just surface interactions.',
    explanation: 'Participating media: absorbs (reduce radiance), emits (fire), scatters — single scattering (light scattered directly toward camera) and multiple scattering (complex inter-bounces).\n\nRaymarch volumetric: march ray through volume in fixed steps; accumulate alpha and color from density field; expensive (64-256 steps per pixel); voxel grid or procedural noise for density.\n\nFroxel (Frustum Voxel) technique: subdivide view frustum into 3D grid of froxels; evaluate lighting and density per froxel in compute shader; raymarch froxel texture cheaply; standard in AAA games.\n\nPhase function: describes angular distribution of scattered light; Henyey-Greenstein g parameter (g=0 isotropic, g>0 forward scatter like water droplets, g<0 back scatter).\n\nExponential height fog: density = exp(-y / H) * density_0; cheap closed-form integral along view ray; approximation for large-scale atmospheric haze.\n\nVolumetric clouds: 3D tileable noise (Perlin-Worley) for cloud density; multiple-octave detail noise for wisps; hero cloud modeling with artist-sculpted SDFs; Horizon Zero Dawn cloud system (epic).\n\nGodray / light shaft: screen-space radial blur from light source position; fast but breaks when occluded; volumetric froxel technique handles correct occlusion by geometry.',
  },

  screen_space_reflections: {
    summary: 'Screen-Space Reflections (SSR) compute reflections by ray marching in screen space (using the depth buffer), providing cheap dynamic reflections on glossy surfaces without requiring ray tracing hardware.',
    explanation: 'Algorithm: at each reflective fragment, compute reflection vector; march ray in screen space (increment by view-space step); test depth buffer at each step; stop when depth difference < threshold (intersection).\n\nHi-Z ray marching: instead of fixed small steps, use hierarchical depth buffer; double step size when ray is above geometry (guaranteed no intersection); O(log N) steps vs O(N).\n\nLimitations: cannot reflect objects outside screen (off-screen content missing); undersampled at grazing angles; incorrect for thick objects (depth buffer is 2.5D); temporal accumulation hides undersampling.\n\nRoughness: specular reflections (roughness=0) use SSR directly; rough surfaces use pre-filtered blurry cone-traced reflection; blend SSR with IBL based on screen-space coverage.\n\nComparison with RT reflections: SSR free on GPU, runs everywhere; misses off-screen and occluded content; RTX reflections correct but expensive; hybrid: SSR for close glossy, RT for edges/missing.\n\nSSLR (Screen-Space Local Reflections): acceleration technique using reprojected previous frame as cheaper marching candidate; reduces divergent rays.\n\nSpatial upsampling + denoising: trace reflections at half resolution; TAA + SVGF (Spatiotemporal Variance-Guided Filtering) denoise and upscale; standard in Unreal Engine, Unity.',
  },

  procedural_generation_gfx: {
    summary: 'Procedural generation creates content algorithmically rather than by hand — terrain, textures, levels, and vegetation — enabling infinite variety and reduced asset storage at the cost of artist control.',
    explanation: 'Perlin noise: smooth pseudo-random gradient noise; lattice of random gradient vectors, interpolated with smoothstep; tileable variants for textures; fractal Brownian motion (fBm): sum octaves at increasing freq/decreasing amplitude.\n\nVoronoi diagram: partition space by nearest seed point; cellular noise; used for cracks, stone textures, procedural cells.\n\nTerrain generation: heightmap from fBm noise + erosion simulation (hydraulic erosion moves material downhill, thermal erosion crumbles steep slopes); domain warping (warp UV by another noise) for natural undulation.\n\nL-Systems (Lindenmayer): formal grammar that rewrites symbols (F = move forward, + = turn right) producing plant/tree structures; fractal self-similarity; used for vegetation in Houdini.\n\nWave Function Collapse (WFC): constraint propagation on a grid; each cell chooses from allowed tile set; propagate adjacency constraints; generates coherent tile-based content (buildings, dungeons) from examples.\n\nProceduralCity: road network (L-System or tensor field), parcel subdivision, building extrusion with facade detail; used in Ghost Recon Breakpoint, Cities Skylines.\n\nSubstance Designer: node-based procedural texture authoring; bake to PBR maps (albedo, normal, roughness, metallic, AO); GPU-accelerated preview; AI-assisted texture generation (Substance AI).',
  },

  framebuffer_objects: {
    summary: 'Framebuffer Objects (FBOs) enable off-screen rendering to textures in OpenGL/Vulkan, forming the basis for post-processing pipelines, shadow maps, G-Buffers, and multi-pass rendering effects.',
    explanation: 'FBO attachments: COLOR_ATTACHMENT0..n (render targets, RGBA8/RGBA16F/RGB10A2), DEPTH_ATTACHMENT (depth buffer 24/32F), STENCIL_ATTACHMENT or DEPTH_STENCIL_ATTACHMENT.\n\nMRT (Multiple Render Targets): write to multiple color attachments simultaneously in one draw call; basis of deferred rendering G-Buffer (albedo RT + normal RT + roughness RT).\n\nRender passes (Vulkan): explicit description of attachments, load/store ops (LOAD, CLEAR, DONT_CARE), subpass dependencies; allows driver to keep tile memory on mobile GPUs without writeback.\n\nPost-processing chain: main scene → HDR FBO → bloom (downsample + blur passes) → tone mapping → FXAA → UI → swapchain; each pass reads previous FBO as texture.\n\nBloom: extract bright areas (threshold), downsample 5 levels (bright pixels spread), Gaussian blur each level, additively blend back; dual-kawase filter cheaper alternative.\n\nHDR rendering: render to RGBA16F FBO; apply tone mapping (ACES, Reinhard, Filmic) to compress HDR range to [0,1]; gamma correction (linearize input → sRGB output); avoids banding in dark areas.\n\nPing-pong FBOs: alternate between two FBOs for effects requiring multiple passes on same texture (iterative blur, fluid simulation); avoid read/write to same texture simultaneously (undefined behavior).',
  },

// ── PROGRAMMING LANGUAGES (continued) ────────────────────────

  effect_system_pl: {
    summary: 'Algebraic effect systems provide a structured way to model and handle computational effects (exceptions, I/O, state, async) as first-class language constructs, enabling modular effect handling without monad transformers.',
    explanation: 'Effects as capabilities: instead of implicit global effects, functions declare their effects in the type signature: f : Int → <IO, Error> Int; callers know exactly what effects can occur.\n\nAlgebraic effects: define effect as a set of operations (raise, ask, yield); each operation has a type but no built-in meaning; effect handlers give operations their semantics.\n\nEffect handler: intercept effects performed in a computation; define how each operation should proceed (resume, abort, transform); handlers are delimited continuations in disguise.\n\nComparison with monads: effects compose automatically (no monad transformer stack); order of handler application determines interaction semantics; more modular than mtl.\n\nKoka (Microsoft Research): language designed around effects; full effect inference; effect polymorphism (functions parametric over effects); compiles to efficient C via FBIP (Functional But In-Place).\n\nOCaml 5 effects: undelimited and delimited continuations; effect handlers as an OCaml language construct; enables efficient I/O, async, and generators; 10-100× faster than continuation-passing style.\n\nEffects vs capabilities: object-capability model (pass objects that represent permissions) is another approach; effects focus on control flow, capabilities on data access.',
  },

  continuations_callcc: {
    summary: 'A continuation represents the "rest of the computation" — what happens after the current expression completes. First-class continuations (call/cc) enable non-local control flow, coroutines, backtracking, and exception handling.',
    explanation: 'Continuation-Passing Style (CPS): every function takes an extra argument k (the continuation = what to do with the result); f x k = k (x + 1); control flow made explicit; enables tail-call optimization of all calls.\n\ncall/cc (call-with-current-continuation): captures current continuation as a callable value; (call/cc (λk. body)) — if k is called with v inside body, returns v to the call/cc site, aborting remaining computation.\n\nSimulating exceptions: store exception handler continuation; when exception raised, call that continuation; natural implementation of try/catch in CPS.\n\nCoroutines via continuations: when coroutine yields, capture current continuation and resume caller; when resumed, call the saved continuation; bidirectional control transfer.\n\nDelimited continuations (shift/reset, control/prompt): capture only a portion of the stack up to the delimiter; composable; better behaved than call/cc.\n\nCPS transformation: every recursive language can be mechanically translated to CPS; enables tail-call elimination (all calls become tail calls); basis of compilers for Scheme, ML, and Haskell core.\n\nContinuations in practice: React\'s async rendering uses continuations conceptually; JavaScript generators are stackless delimited continuations; async/await desugars to state machine = CPS.',
  },

  logic_programming_pl: {
    summary: 'Logic programming expresses computation as a set of logical relations and queries, with the runtime performing automatic proof search (resolution + unification) to find solutions. Prolog is the canonical language; Datalog is the declarative subset used in databases.',
    explanation: 'Horn clauses: fact (parent(tom, bob).), rule (ancestor(X,Y) :- parent(X,Y). and ancestor(X,Y) :- parent(X,Z), ancestor(Z,Y).), query (?- ancestor(tom, ann).).\n\nUnification: match two terms by substituting variables; unify(f(X, b), f(a, Y)) → {X=a, Y=b}; Robinson\'s unification algorithm; foundation of type inference and term rewriting.\n\nSLD resolution: Selective Linear Definite resolution; depth-first search through proof tree; backtracking when subgoal fails; choice points for non-determinism.\n\nCut (!): prunes search tree, commits to current choice; green cut (no semantic change, only efficiency) vs red cut (changes meaning, fragile); limits backtracking.\n\nProlog lists: [H|T] head-tail unification; recursive list processing; difference lists for O(1) append; DCG (Definite Clause Grammars) for natural language parsing.\n\nDatalog: restriction of Prolog (no function symbols, stratified negation, guaranteed termination); used in program analysis (Souffle, Doop), security policies (RBAC), Semantic Web (SPARQL).\n\nConstraint Logic Programming (CLP): extend Prolog with constraint solvers (CLP(FD) for finite domains, CLP(R) for reals); Mozart/Oz; solve scheduling, planning, configuration problems.',
  },

// ── NETWORKING (continued) ────────────────────────────────────

  dns_internals: {
    summary: 'The Domain Name System (DNS) is a hierarchical, distributed database that maps domain names to IP addresses. It uses a tree of authoritative nameservers, recursive resolvers, and caching to answer billions of queries per second globally.',
    explanation: 'Hierarchy: root nameservers (13 root clusters, anycast) → TLD nameservers (.com, .org) → authoritative nameservers (ns1.example.com holds records for example.com).\n\nResolution: stub resolver asks recursive resolver (ISP or 8.8.8.8); recursive resolver asks root → TLD → authoritative; caches responses per TTL (300-86400 seconds).\n\nRecord types: A (IPv4), AAAA (IPv6), CNAME (alias to canonical name), MX (mail exchanger with priority), TXT (SPF, DKIM, verification), NS (nameserver), SOA (zone authority), PTR (reverse lookup), SRV (service location), CAA (cert authority allowed).\n\nDNSSEC: cryptographic signatures on DNS records; zone signing key (ZSK) signs records, key signing key (KSK) signs DNSEC; chain of trust from root to TLD to zone; RRSIG, DNSKEY, DS records.\n\nDNS over HTTPS (DoH) / DNS over TLS (DoT): encrypt DNS queries preventing ISP surveillance and MITM; DoH uses HTTPS port 443 (hard to block), DoT uses port 853; Cloudflare 1.1.1.1, Google 8.8.8.8.\n\nDNS cache poisoning (Kaminsky attack): inject forged DNS responses to redirect domain; randomized source port + query ID prevents; DNSSEC cryptographically prevents.\n\nDNS-based load balancing: multiple A records for same name (round-robin), weighted routing, health-checked failover; Route 53 active-active/active-passive; GeoDNS routes by client IP geography.',
  },

  bgp_routing_advanced: {
    summary: 'BGP (Border Gateway Protocol) is the routing protocol of the internet, connecting autonomous systems (AS) by exchanging path-vector reachability information. Understanding BGP is essential for network architects, cloud engineers, and anyone dealing with multi-homed or SD-WAN deployments.',
    explanation: 'BGP concepts: AS (Autonomous System, identified by 16/32-bit ASN), EBGP (between different AS peers, TTL=1), IBGP (within same AS, full mesh or route reflectors).\n\nPath attributes: AS_PATH (loop prevention — discard if own ASN in path), NEXT_HOP, LOCAL_PREF (highest preferred within AS), MED (Multi-Exit Discriminator, hint to neighbor for path selection), COMMUNITY (group routes for policy).\n\nRoute selection: highest LOCAL_PREF → shortest AS_PATH → lowest MED → EBGP over IBGP → lowest IGP metric to next-hop → lowest router-ID.\n\nBGP security: route hijacking (announce victim\'s prefixes, intercept traffic); RPKI (Resource Public Key Infrastructure): cryptographically signs AS→prefix ownership; ROAs (Route Origin Authorizations); RPKI-validated ROUTE_ORIGIN records filter invalid announcements.\n\nBGP in the cloud: AWS Direct Connect, Azure ExpressRoute use BGP; on-premise routers peer with cloud edge; dynamic route propagation; communities to influence path selection.\n\nBGP communities: well-known (NO_EXPORT prevents re-advertising to EBGP, NO_ADVERTISE), extended communities for VPNv4 (route targets), large communities (RFC 8092) for global policy.\n\nRoute reflectors: IBGP requires full mesh (n² peers); route reflector re-advertises IBGP learned routes to IBGP clients; cluster of RRs provides redundancy without full mesh.',
  },

  network_time_sync: {
    summary: 'Network Time Protocol (NTP) and its precision successor PTP synchronize distributed system clocks to enable consistent timestamps, certificate validity checks, security protocol freshness, and distributed coordination.',
    explanation: 'NTP hierarchy: stratum 0 (atomic clock, GPS), stratum 1 (directly connected to stratum 0), stratum 2 (syncs to stratum 1), etc.; stratum 16 = unsynchronized; drift between strata ~1ms per stratum.\n\nNTP algorithm: client sends request with T1 (client send time); server records T2 (receive time), T3 (send time); client records T4; offset θ = ((T2-T1)+(T3-T4))/2; round-trip delay δ = (T4-T1)-(T3-T2).\n\nClock discipline: Linux kernel clock discipline uses PLL (Phase Locked Loop) or FLL; slew (gradual correction ≤0.5ms/s) vs step (immediate jump, requires authorization); adjtimex system call.\n\nPTP (Precision Time Protocol, IEEE 1588): hardware timestamping at NIC; sub-microsecond accuracy; master/slave hierarchy per domain; Transparent Clocks (switches measure queuing delay) improve accuracy.\n\nLinuxPTP (ptp4l + phc2sys): ptp4l syncs PTP hardware clock; phc2sys syncs system clock to hardware; used in 5G fronthaul, financial exchanges, industrial automation.\n\nImportance for security: TLS certificate expiry checked against system time; Kerberos tickets have 5-minute skew tolerance (anti-replay); JWT exp claim verified against current time; time skew = security vulnerability.\n\nGPS-disciplined oscillators: organizations attach GPS receivers for stratum 0 time source; NTP server serves from GPS PPS (pulse-per-second) signal for sub-microsecond local accuracy.',
  },

  // ════ B12 ════

// Robotics, Advanced Signal Processing, Advanced Control Systems, Audio/Video Processing

// ── Robotics ─────────────────────────────────────────────────

  forward_kinematics: {
    summary: 'Forward kinematics computes the end-effector pose given joint angles using a chain of homogeneous transforms.',
    explanation: 'Denavit-Hartenberg (DH) parameters (a, d, α, θ) define each joint frame relative to the previous one.\n'
      + 'Each joint contributes a 4×4 homogeneous transform T_i = Rot_z(θ_i) × Trans_z(d_i) × Trans_x(a_i) × Rot_x(α_i).\n'
      + 'The full chain composes as T_0n = T_01 × T_12 × ... × T_(n-1)n, yielding end-effector position and orientation.\n'
      + 'Product of Exponentials (PoE) is an alternative formulation using Lie algebra twists: T = e^{[S_1]θ_1} × ... × e^{[S_n]θ_n} × M.\n'
      + 'For a 6-DOF serial manipulator the result is a 4×4 SE(3) matrix encoding a 3D rotation and translation.\n'
      + 'FK is computationally simple and always has a unique solution given joint angles; it underlies all trajectory execution.',
  },

  inverse_kinematics: {
    summary: 'Inverse kinematics finds the joint angles that achieve a desired end-effector pose, the reverse problem of FK.',
    explanation: 'Analytical IK solves closed-form equations for specific geometries such as the PUMA arm or a spherical wrist (last three axes intersecting).\n'
      + 'Numerical IK iterates via the Jacobian pseudoinverse: Δq = J⁺ Δx, where J⁺ = J^T(JJ^T)^{-1} for overdetermined and J^T(J^TJ)^{-1} for underdetermined cases.\n'
      + 'Redundancy resolution (>6 DOF) minimizes a secondary objective ||q̇|| or keeps joints away from limits using null-space projection q̇ = J⁺ẋ + (I−J⁺J)q̇₀.\n'
      + 'FABRIK (Forward and Backward Reaching IK) is an iterative geometric method that is fast and handles joint limits well.\n'
      + 'Multiple IK solutions exist for most configurations; the solver must select among them using continuity or proximity criteria.\n'
      + 'Singularities occur when J loses rank, making some directions uncontrollable; damped least-squares (DLS) J⁺ = J^T(JJ^T + λI)^{-1} provides robustness.',
  },

  jacobian_matrix_robotics: {
    summary: 'The Jacobian matrix maps joint velocities to end-effector linear and angular velocities, and is central to velocity-level robot control.',
    explanation: 'J(q) is a 6×n matrix partitioned as [J_v; J_ω], where J_v relates joint rates to linear velocity and J_ω to angular velocity of the end-effector.\n'
      + 'Each column J_i = ∂x/∂q_i; for revolute joints J_v_i = z_{i-1} × (p_e − p_{i-1}) and J_ω_i = z_{i-1}.\n'
      + 'Singularities occur when det(J)=0 (square J) or rank drops; the robot loses the ability to move in one or more Cartesian directions.\n'
      + 'Manipulability measure w = √det(JJ^T) quantifies how far from singularity; ellipsoid axes reveal preferred motion directions.\n'
      + 'Condition number κ(J) = σ_max/σ_min indicates sensitivity; large κ signals proximity to singularity and poor force/torque transmission.\n'
      + 'Force transmission uses the transpose: τ = J^T F_e, so Jacobian transpose control applies end-effector forces via joint torques.',
  },

  robot_dynamics: {
    summary: 'Robot dynamics models the relationship between joint torques and motion through inertia, Coriolis, and gravitational effects.',
    explanation: 'The Lagrangian equation of motion is τ = M(q)q̈ + C(q,q̇)q̇ + G(q), where M is the n×n symmetric positive-definite inertia matrix.\n'
      + 'C(q,q̇) contains Coriolis and centrifugal terms computed from Christoffel symbols: C_{ijk} = (1/2)(∂M_ij/∂q_k + ∂M_ik/∂q_j − ∂M_jk/∂q_i).\n'
      + 'G(q) = ∂V/∂q is the gradient of potential energy with respect to joint coordinates.\n'
      + 'Newton-Euler recursion computes the same result in O(n) by propagating velocities/accelerations outward then forces inward.\n'
      + 'Featherstone spatial algebra (Articulated Body Algorithm) also achieves O(n) and is numerically efficient for branching kinematic trees.\n'
      + 'Computed torque control uses the inverse dynamics model τ = M(q)u + C(q,q̇)q̇ + G(q) to linearize the robot, then applies a PD outer loop u = q̈_d + K_d(q̇_d−q̇) + K_p(q_d−q).',
  },

  trajectory_planning_robotics: {
    summary: 'Trajectory planning generates smooth, time-parameterized motion profiles between waypoints respecting velocity and acceleration limits.',
    explanation: 'Joint-space cubic spline interpolation enforces continuous position and velocity at waypoints: q(t) = a₀ + a₁t + a₂t² + a₃t³, four coefficients per segment.\n'
      + 'Trapezoidal velocity profile (linear ramp up, constant cruise, linear ramp down) minimizes time subject to maximum velocity and acceleration constraints.\n'
      + 'S-curve (seventh-degree polynomial) limits jerk in addition to acceleration, reducing structural vibrations in high-precision applications.\n'
      + 'Cartesian-space planning interpolates position linearly (straight line) and orientation via SLERP on SO(3) quaternions between keyframes.\n'
      + 'Time-optimal trajectory planning along a path solves a 2D bang-bang control problem in (s, ṡ) phase plane subject to joint torque limits.\n'
      + 'Via-point retiming adjusts duration of each segment to synchronize multiple joints while preserving path shape and limit compliance.',
  },

  path_planning_rrt: {
    summary: 'Sampling-based path planning algorithms like RRT and PRM efficiently find collision-free paths in high-dimensional configuration spaces.',
    explanation: 'RRT (Rapidly-exploring Random Tree) grows a tree by sampling q_rand, finding the nearest node q_near, and extending toward q_rand by step size δ.\n'
      + 'RRT*: after each extension, rewires the tree by checking if newly added node offers shorter paths to nearby nodes; asymptotically optimal.\n'
      + 'PRM (Probabilistic Roadmap Method) builds a roadmap offline by sampling N collision-free configurations and connecting them with a local planner, then queries with A*.\n'
      + 'Configuration space (C-space) maps robot bodies and obstacles into a joint-angle space where a point represents a complete robot pose.\n'
      + 'Bidirectional RRT-Connect grows trees from start and goal simultaneously, dramatically reducing planning time in practice.\n'
      + 'Informed RRT* focuses samples inside an ellipsoidal subset once an initial solution is found, accelerating convergence to the optimum.',
  },

  slam_algorithm: {
    summary: 'SLAM simultaneously builds a map of an unknown environment and localizes the robot within that map, solving a chicken-and-egg problem.',
    explanation: 'EKF-SLAM maintains a joint state vector [robot pose; landmark positions] and uses linearized update equations, growing O(n²) with landmark count.\n'
      + 'FastSLAM factorizes the posterior into a particle filter over robot paths and per-landmark EKFs (one per particle), enabling O(n log n) updates.\n'
      + 'Graph-SLAM formulates the problem as a nonlinear least-squares factor graph: nodes are poses, edges are odometry/sensor constraints; g2o/GTSAM solve via LM.\n'
      + 'Loop closure detection recognizes previously visited places (bag-of-words, DBoW2, NetVLAD) and adds a long-range constraint to correct accumulated drift.\n'
      + 'ORB-SLAM3 tracks ORB features, builds a covisibility graph, and supports monocular/stereo/RGB-D with multi-map merging and relocalization.\n'
      + 'LiDAR SLAM (Cartographer, LOAM) uses scan matching (ICP or NDT) for odometry and submaps with branch-and-bound loop closure for global consistency.',
  },

  visual_odometry: {
    summary: 'Visual odometry estimates camera motion incrementally from image sequences by tracking or matching visual features across frames.',
    explanation: 'Feature-based VO detects keypoints (ORB, SIFT, SuperPoint), computes descriptors, and matches across frames using descriptor distance with LOWE ratio test.\n'
      + 'Motion estimation uses the 5-point algorithm on matched inliers to recover the essential matrix E = t× R, then RANSAC discards outliers.\n'
      + 'Monocular VO suffers from scale ambiguity; metric scale requires either stereo (known baseline Z = bf/d) or fusion with absolute sensors like GPS or pressure.\n'
      + 'Direct methods (DSO, LSD-SLAM) minimize photometric error directly on pixel intensities without explicit feature extraction, enabling operation in texture-poor scenes.\n'
      + 'Visual-Inertial Odometry (VIO) tightly couples IMU pre-integration with visual BA in a sliding-window factor graph (VINS-Mono, OKVIS) for drift-reduced metric VO.\n'
      + 'Drift accumulates; local bundle adjustment over a sliding window of keyframes with shared landmarks corrects short-term accumulation before loop closure.',
  },

  lidar_processing: {
    summary: 'LiDAR point cloud processing extracts geometric structure from 3D range measurements for mapping, object detection, and robot navigation.',
    explanation: 'Rotating mechanical LiDAR (Velodyne) emits N laser rings producing ~100k–1M points/sec; solid-state (Livox, MEMS) uses non-repetitive scan patterns.\n'
      + 'VoxelGrid downsampling averages all points within each voxel to a centroid, reducing density while preserving shape for faster downstream processing.\n'
      + 'Normal estimation fits a local plane via PCA of the k-nearest-neighbor covariance matrix; eigenvalue ratio indicates surface curvature.\n'
      + 'ICP (Iterative Closest Point) aligns two point clouds by alternating between finding closest-point correspondences and solving the optimal rigid transform (SVD).\n'
      + 'NDT (Normal Distributions Transform) models each voxel as a Gaussian distribution and maximizes the probability of transformed scan points, more robust than ICP.\n'
      + 'PointNet applies a shared MLP + global max-pool for set-invariant 3D classification; PointNet++ adds hierarchical local grouping for dense tasks.',
  },

  imu_sensor_fusion: {
    summary: 'IMU sensor fusion combines accelerometer, gyroscope, and optionally magnetometer data to estimate orientation and track motion with bounded drift.',
    explanation: 'Gyroscope integrates angular velocity ω to update quaternion: q_{t+dt} = q_t ⊗ exp((ω dt)/2), but bias and noise cause unbounded drift over time.\n'
      + 'Accelerometer measures gravity + linear acceleration; in quasi-static conditions it provides absolute tilt (roll, pitch) but not yaw.\n'
      + 'Complementary filter fuses high-pass filtered gyro integration with low-pass filtered accelerometer tilt using α: θ = α(θ + ω dt) + (1−α) θ_acc.\n'
      + 'Mahony/Madgwick filters use gradient-descent-based attitude correction that is computationally cheap and suitable for embedded MCUs.\n'
      + 'Error-state Kalman filter (ESKF) maintains error state δx around nominal trajectory, linearizes around current estimate, then resets error after each update.\n'
      + 'Allan variance analysis quantifies IMU noise sources: angle random walk (white noise), bias instability (1/f), rate random walk; used for KF noise parameter tuning.',
  },

  ros_architecture: {
    summary: 'ROS (Robot Operating System) provides a middleware framework of nodes, topics, services, and tools for building modular robot software.',
    explanation: 'Nodes are independent processes communicating over named topics using publish-subscribe; messages are strongly typed (sensor_msgs, geometry_msgs, nav_msgs).\n'
      + 'Services provide synchronous RPC: client sends request, server returns response; suitable for infrequent configuration or query operations.\n'
      + 'Actions (actionlib/ROS2 action) support long-running tasks with goal/feedback/result, allowing preemption and progress monitoring.\n'
      + 'tf2 maintains a tree of coordinate frame transforms timestamped in a buffer, enabling any node to query the transform between any two frames at any time.\n'
      + 'ROS2 replaces roscore with DDS (Data Distribution Service) middleware (Fast-DDS, CycloneDDS), supporting QoS policies, real-time execution, and multi-robot systems.\n'
      + 'ROS2 lifecycle nodes enable explicit state transitions (configure, activate, deactivate, cleanup), critical for deterministic startup in safety-sensitive applications.',
  },

  quadrotor_dynamics: {
    summary: 'A quadrotor is an underactuated 6-DOF aerial vehicle where four rotors generate coupled thrust and torque for position and attitude control.',
    explanation: 'Each rotor i produces thrust F_i = k_T ω_i² (upward) and reaction torque M_i = k_Q ω_i² (opposing rotation), giving four independent scalar inputs.\n'
      + 'The Newton-Euler equations yield ẍ = (1/m) R T e₃ − g e₃ for translation and İ·ω + ω×Iω = τ_body for rotation, where R is the body-to-world rotation.\n'
      + 'Motor mixing matrix maps [T; τ_x; τ_y; τ_z] to [ω₁²; ω₂²; ω₃²; ω₄²]; for a plus configuration with arms along axes, the matrix has a specific ±1, ±k pattern.\n'
      + 'Cascade control: outer position loop (PD) generates desired thrust vector, middle attitude loop (SO(3) or quaternion error PD) generates desired angular rate, inner rate loop closes on gyro.\n'
      + 'Differential flatness with flat outputs (x, y, z, ψ) allows any smooth trajectory in flat space to be mapped to feasible state and input trajectories analytically.\n'
      + 'Minimum-snap trajectory optimization (Mellinger & Kumar) minimizes ∫||d⁴p/dt⁴||² as a QP in polynomial coefficients, producing smooth, dynamically feasible paths.',
  },

  robotic_manipulation: {
    summary: 'Robotic manipulation encompasses grasp planning, task and motion planning, and compliant control for physically interacting with objects.',
    explanation: 'Grasp quality is evaluated using the Grasp Wrench Space (GWS): a grasp achieves force closure if the convex hull of contact wrenches contains the origin.\n'
      + 'Task and Motion Planning (TAMP) combines symbolic task planning (PDDL, PDDLStream) with continuous motion planning to handle multi-step manipulation sequences.\n'
      + 'MoveIt! provides a motion planning pipeline (OMPL backends: RRT, RRT*, STOMP, CHOMP), collision checking (FCL), and kinematics (KDL, IKFast).\n'
      + 'Compliant control is essential for contact-rich tasks: impedance/admittance control shapes the mechanical interaction stiffness and damping.\n'
      + 'Dexterous in-hand manipulation (finger gaiting, regrasping) requires high-dimensional state estimation and planning in the hand configuration space.\n'
      + 'Deformable and granular objects require special representations (point clouds, meshes, or particle-based simulations) for state estimation and manipulation planning.',
  },

  force_torque_control: {
    summary: 'Force/torque control regulates the mechanical interaction forces between robot and environment, essential for assembly, polishing, and surgical tasks.',
    explanation: 'Impedance control specifies a desired dynamic relationship: M_d(ẍ−ẍ_d) + D_d(ẋ−ẋ_d) + K_d(x−x_d) = F_ext, making the robot appear as a spring-damper system.\n'
      + 'Admittance control is the dual: measure contact force F_ext, compute desired motion correction Δx from the impedance model, feed to position controller.\n'
      + 'Hybrid force/position control (Raibert & Craig) decomposes task space into constrained DOFs (force-controlled) and unconstrained DOFs (position-controlled) using a selection matrix S.\n'
      + 'F/T sensor placement affects bandwidth: wrist-mounted sensors capture all contact forces but limit tool-change flexibility; joint torque sensing enables whole-arm force control.\n'
      + 'Tactile sensor arrays (capacitive, piezoresistive) provide distributed contact information for slip detection and dexterous grasping.\n'
      + 'Passivity-based control guarantees stability for any passive environment by ensuring the port Hamiltonian is non-increasing; implemented via energy tanks in teleoperation.',
  },

  robot_learning_rl: {
    summary: 'Robot learning uses reinforcement learning and imitation learning to acquire manipulation and locomotion policies that generalize across tasks and environments.',
    explanation: 'Sim-to-real transfer trains policies in physics simulation (MuJoCo, Isaac Gym) and deploys to real hardware; domain randomization over physics parameters bridges the gap.\n'
      + 'Behavior cloning (BC) trains a policy π_θ(a|s) by supervised learning on expert demonstrations; compounding errors (DAgger: iterative data aggregation with online expert) mitigate distribution shift.\n'
      + 'Proximal Policy Optimization (PPO) and Soft Actor-Critic (SAC) are the dominant model-free algorithms; SAC\'s entropy regularization promotes exploration and robustness.\n'
      + 'Model-based RL (MBPO, Dreamer) learns a world model for imagination-based planning, improving sample efficiency by 10-100× over model-free methods.\n'
      + 'Real-robot RL requires safe exploration strategies: constrained MDP, safety layers projecting actions to safe sets, or human-in-the-loop intervention.\n'
      + 'Vision-based manipulation policies use data augmentation (random crop, color jitter) and self-supervised representations (R3M, MVP) to reduce sample requirements.',
  },

  collision_avoidance_robot: {
    summary: 'Collision avoidance ensures robots navigate safely around static and dynamic obstacles using geometric, velocity-space, or optimization-based methods.',
    explanation: 'Artificial Potential Fields (APF) superpose an attractive potential U_att = (1/2) k_att ||x−x_goal||² and repulsive potentials U_rep near obstacles; gradient descent drives motion.\n'
      + 'Velocity Obstacles (VO) represent the set of robot velocities that would cause collision with an obstacle within a time horizon; robot must choose velocity outside all VOs.\n'
      + 'ORCA (Optimal Reciprocal Collision Avoidance) solves a linear programming problem to find the minimum velocity perturbation satisfying all half-plane collision constraints simultaneously.\n'
      + 'Signed Distance Functions (SDF) compute the signed distance to the nearest obstacle surface; positive outside, negative inside; gradient gives closest-surface direction.\n'
      + 'Control Barrier Functions (CBF): design h(x) ≥ 0 as a safety certificate; enforce ḣ(x) + γh(x) ≥ 0 as a QP constraint alongside the nominal control objective.\n'
      + 'For manipulators, C-space obstacles are computed by sweeping robot links through workspace obstacles; capsule-capsule distance checks enable real-time self-collision detection.',
  },

  stereo_vision_robot: {
    summary: 'Stereo vision recovers metric depth from a calibrated two-camera system by triangulating matched pixel correspondences using the known baseline.',
    explanation: 'For a rectified stereo pair with baseline b and focal length f, depth Z = b·f / d, where disparity d = x_L − x_R is the horizontal pixel offset between matched points.\n'
      + 'The epipolar constraint restricts correspondences to a single scanline after rectification, reducing the 2D matching search to a 1D problem.\n'
      + 'Block matching (BM) computes the sum of absolute differences (SAD) over a window for each disparity candidate; computationally fast but inaccurate at depth discontinuities.\n'
      + 'Semi-Global Matching (SGM/SGBM) minimizes a global energy along multiple scanline directions, balancing local matching with smoothness constraints.\n'
      + 'Deep stereo networks (PSMNet, RAFT-Stereo) build 4D cost volumes over disparity hypotheses and apply 3D convolutions for spatially consistent disparity maps.\n'
      + 'Calibration uses Zhang\'s checkerboard method; stereo rectification computes homographies aligning epipolar lines to horizontal scanlines and scales depth error with Z².',
  },

  point_cloud_processing: {
    summary: 'Point cloud processing algorithms extract geometric structure from unordered 3D point sets for applications in mapping, object recognition, and surface reconstruction.',
    explanation: 'PCL (Point Cloud Library) provides VoxelGrid downsampling, statistical outlier removal, and organized/unorganized cloud representations with KdTree / OctTree indices.\n'
      + 'Normal estimation performs PCA on the k-nearest-neighbor covariance matrix; the eigenvector corresponding to the smallest eigenvalue is the surface normal.\n'
      + 'RANSAC plane fitting iteratively selects 3 random points, fits a plane, counts inliers within distance ε, retaining the model with the most inliers after N iterations.\n'
      + 'ICP iterates: (1) find nearest neighbor correspondences, (2) solve optimal rotation/translation via SVD of the cross-covariance matrix, (3) apply transform, repeat until convergence.\n'
      + 'TEASER++ provides a certifiably correct, outlier-robust point cloud registration using graduated non-convexity decoupled rotation/translation estimation.\n'
      + 'PointNet++ hierarchically groups points with ball queries, applies PointNet per group (set abstraction), enabling multi-scale feature learning for segmentation and classification.',
  },

  occupancy_mapping: {
    summary: 'Occupancy mapping maintains a probabilistic grid representation of free, occupied, and unknown space for robot navigation planning.',
    explanation: 'Each cell stores log-odds l = log(p/(1−p)); inverse sensor model adds l_occ or l_free per ray; log-odds update: l_t = l_{t-1} + l_sensor(z|x) − l_0.\n'
      + 'Beam sensor model decomposes range measurement probability into four components: hit (Gaussian near expected range), short (exponential), max (spike at max range), random.\n'
      + 'OctoMap uses a memory-efficient octree structure, storing only non-empty nodes and supporting adaptive resolution; typical voxel size 5–20 cm for indoor mapping.\n'
      + 'Truncated Signed Distance Function (TSDF) represents the environment as the signed distance to the nearest surface, truncated to ±δ; volume fusion accumulates weighted TSDF updates from depth images.\n'
      + 'KinectFusion (Newcombe et al.) integrates depth frames into a TSDF volume on GPU at 30 Hz, enabling real-time dense 3D reconstruction from an RGB-D camera.\n'
      + 'Elevation maps represent outdoor terrain as a 2.5D height grid; probabilistic variants (Fankhauser) handle uncertainty from sensor noise and robot odometry error.',
  },

  monte_carlo_localization: {
    summary: 'Monte Carlo Localization (MCL) uses a particle filter to represent the robot pose distribution and update it with motion and sensor models.',
    explanation: 'N weighted particles {(x_i, w_i)} represent the belief bel(x_t) = p(x_t|z_{1:t}, u_{1:t}); more particles concentrate near high-probability regions.\n'
      + 'Prediction step samples each particle through the probabilistic motion model: x_t^i ~ p(x_t|u_t, x_{t-1}^i), introducing noise consistent with odometry uncertainty.\n'
      + 'Measurement update weights each particle: w_t^i = p(z_t|x_t^i), computed from the beam model comparing expected and actual range readings at particle pose x_t^i.\n'
      + 'Systematic resampling draws N new particles proportional to weights, placing a single pointer at random start then stepping uniformly through the CDF (lower variance than multinomial).\n'
      + 'KLD-sampling adapts N dynamically: more particles when distribution is spread out, fewer when concentrated; bounds approximate KL-divergence to true distribution.\n'
      + 'AMCL (Adaptive MCL) adds a random-pose injection with probability proportional to how poorly the current particles explain measurements, enabling recovery from kidnap.',
  },

  deformable_object_manip: {
    summary: 'Deformable object manipulation handles cloth, rope, and granular materials whose infinite-dimensional state and complex contact dynamics challenge classical planning.',
    explanation: 'Finite Element Method (FEM) discretizes deformable bodies into elements; each element contributes stiffness K and mass M matrices; solve Ma + Cv + Kx = F per timestep.\n'
      + 'Position-Based Dynamics (PBD) iteratively satisfies geometric constraints rather than forces, enabling real-time cloth simulation with controllable stiffness via iterations.\n'
      + 'Differentiable simulation (DiffTaichi, PlasticineLab) backpropagates gradients through simulation steps, enabling planning or imitation learning of deformable manipulation policies.\n'
      + 'Shape-conditioned policies represent deformable state as a point cloud or mesh; PointNet or GNN encoders extract shape features for downstream policy networks.\n'
      + 'Major challenges include infinite-dimensional configuration space, self-contact, occlusion during manipulation, and sim-to-real transfer of material parameters.\n'
      + 'Applications: surgical tissue retraction, robotic laundry folding (state estimation via depth + segmentation), granular food handling requiring force-controlled scooping.',
  },

  medical_robotics: {
    summary: 'Medical robotics enhances surgical precision and dexterity through teleoperation, image guidance, and miniaturized compliant instruments.',
    explanation: 'The da Vinci Surgical System uses a master-slave teleoperation architecture: surgeon manipulates haptic consoles, scaling and tremor-filtering motions to 5-mm wristed instruments.\n'
      + 'Force feedback in cable-driven instruments is limited by cable friction and elasticity; current systems provide no haptic return; tactile sensing research aims to restore it.\n'
      + 'Image-to-patient registration aligns preoperative CT/MRI to intraoperative anatomy using fiducial markers or surface ICP; sub-millimeter accuracy enables navigation overlays.\n'
      + 'Continuum robots (concentric tube robots, tendon-driven) navigate through body orifices via natural openings, providing access to otherwise unreachable anatomy.\n'
      + 'Safety-critical design requires redundant sensing, compliant actuation with force limits, verified software with DO-178C/IEC 62304 standards, and FDA 510(k) clearance.\n'
      + 'Autonomous subtask automation (needle insertion, suturing, tissue grasping) uses visual servoing closed over stereo endoscope images for cm-scale semi-autonomous assistance.',
  },

  soft_robotics: {
    summary: 'Soft robotics uses compliant, elastomeric actuators and structures to achieve safe interaction with humans and adaptation to unstructured environments.',
    explanation: 'Pneumatic soft actuators (PneuNets, fiber-reinforced) inflate silicone chambers with inextensible fiber constraints to produce bending, extension, or twisting motions.\n'
      + 'Shape Memory Alloys (SMA, e.g., Nitinol) contract ~8% strain when heated above austenite transition temperature; slow actuation bandwidth (~1 Hz) limits dynamic applications.\n'
      + 'Dielectric Elastomer Actuators (DEA) compress under high-voltage (kV range) electrostatic pressure, producing large strains; flexible, silent, and muscle-like.\n'
      + 'Cosserat rod model describes soft manipulator kinematics as a continuous beam with strain variables (curvature κ, shear γ, elongation ε) along arc length s.\n'
      + 'Model-free control approaches (reinforcement learning, echo state networks, neural networks) circumvent the difficulty of analytical soft-body models for control design.\n'
      + 'Fabrication methods include soft lithography (PDMS molding), multi-material 3D printing (Connex), and embedded air channels created with wax or water-soluble support.',
  },

  robot_perception: {
    summary: 'A robot perception pipeline fuses data from multiple sensors to produce a semantic understanding of the environment for autonomous decision-making.',
    explanation: 'Sensor modalities are fused at the decision, feature, or data level: early fusion concatenates raw measurements, late fusion combines independent detection outputs.\n'
      + '2D object detection (YOLOv8, Faster-RCNN) processes RGB images; 3D detection (PointPillars, CenterPoint) processes LiDAR voxel columns for autonomous driving perception.\n'
      + 'Depth completion fuses sparse LiDAR depth with dense RGB using guided convolutional networks to produce dense metric depth maps for navigation and manipulation.\n'
      + 'Multi-object tracking uses Kalman filter state prediction with Hungarian algorithm data association (SORT, ByteTrack, StrongSORT) to maintain consistent object identities over time.\n'
      + 'Semantic segmentation (DeepLabV3+, SegFormer) labels each pixel; Panoptic FPN combines semantic (stuff) and instance (things) segmentation in a single forward pass.\n'
      + 'Uncertainty estimation via deep ensembles or MC Dropout quantifies aleatoric and epistemic uncertainty, enabling cautious behavior in low-confidence perception regions.',
  },

  grasping_planning: {
    summary: 'Grasp planning computes stable grasp configurations for robot grippers using quality metrics, learned models, or geometric analysis of object shape.',
    explanation: 'Force closure guarantees that any external wrench can be resisted by non-negative contact forces; computed by checking if the origin lies strictly inside the Grasp Wrench Space (GWS) convex hull.\n'
      + 'Grasp quality metrics include ε (radius of largest inscribed hypersphere in GWS) and v (GWS volume); higher values indicate more robust grasps against uncertainty.\n'
      + 'GQ-CNN (Grasp Quality CNN) predicts grasp success probability from a depth image patch centered on a candidate 6-DOF grasp, trained on 6.7 million simulated grasps (Dex-Net).\n'
      + 'GraspNet and Contact-GraspNet predict dense 6-DOF grasps directly from point clouds using surface normals, enabling generalization to unseen objects.\n'
      + 'Antipodal grasps for parallel-jaw grippers require two contact points with friction cones spanning the line connecting them; efficient algorithms search shape antipodal pairs.\n'
      + 'Sim-to-real transfer leverages analytic contact models in simulation for dataset generation; domain randomization of object pose, shape, and material properties closes the reality gap.',
  },

// ── Advanced Signal Processing ────────────────────────────────

  wavelet_transform_adv: {
    summary: 'Advanced wavelet analysis decomposes signals into time-frequency atoms using multiresolution analysis, enabling efficient representation of transients and edges.',
    explanation: 'Multiresolution Analysis (MRA) decomposes a signal into approximation (low-pass) and detail (high-pass) coefficients at each scale via conjugate quadrature filter (QMF) pairs.\n'
      + 'Mallat fast algorithm applies the filter bank in O(N) operations: downsample by 2 after each level, recursively decomposing only the approximation sub-band (dyadic tree).\n'
      + 'Daubechies wavelets have compact support and maximum vanishing moments for their support length; db4 has 4 vanishing moments and 8-tap filters, balancing time-frequency localization.\n'
      + '2D DWT applies 1D DWT along rows then columns, producing LL (approximation), LH, HL, HH subbands; used in JPEG2000 for progressive lossless/lossy image compression.\n'
      + 'Complex wavelets (Dual-Tree CWT, Kingsbury) achieve approximate shift-invariance by using two real filter banks (real+imaginary parts) at the cost of 2× redundancy.\n'
      + 'Wavelet packets decompose both approximation AND detail subbands at each level (full binary tree); best-basis algorithm selects the tree minimizing entropy of coefficients.',
  },

  compressive_sensing_adv: {
    summary: 'Compressive sensing recovers sparse signals from far fewer measurements than the Nyquist rate by exploiting sparsity in a known basis.',
    explanation: 'Measurement model y = Φx: m measurements of n-dimensional sparse signal x (s non-zeros, s << n); recovery is possible when m ≥ O(s log(n/s)).\n'
      + 'Restricted Isometry Property (RIP): Φ preserves norms of all s-sparse vectors: (1−δ)||x||₂² ≤ ||Φx||₂² ≤ (1+δ)||x||₂²; random Gaussian/Bernoulli matrices satisfy RIP with high probability.\n'
      + 'L1 minimization (Basis Pursuit): min||x||₁ subject to y=Φx; convex relaxation of the NP-hard L0 problem; solved with interior-point methods, ADMM, or FISTA.\n'
      + 'LASSO: min(1/2)||y−Φx||₂² + λ||x||₁; balances data fidelity with sparsity; solution path computed efficiently via LARS algorithm.\n'
      + 'Greedy algorithms: OMP adds one atom per iteration (select column of Φ most correlated with residual, project, update residual); CoSaMP and IHT give improved theoretical guarantees.\n'
      + 'Applications: MRI compressed sensing (k-space under-sampling, 8-10× speedup), single-pixel camera, radar waveform design, channel estimation in sparse multipath channels.',
  },

  array_signal_processing: {
    summary: 'Array signal processing uses spatially distributed sensors to perform beamforming and direction-of-arrival estimation by exploiting wavefront phase differences.',
    explanation: 'For a Uniform Linear Array (ULA) of M elements with spacing d, the steering vector a(θ) = [1, e^{jkd sinθ}, ..., e^{j(M-1)kd sinθ}]^T where k = 2π/λ.\n'
      + 'Conventional delay-and-sum beamformer applies weights w = a(θ_0)/M; output y(t) = w^H x(t); spatial resolution ~λ/Md, sidelobes limit interference rejection.\n'
      + 'MVDR (Capon) beamformer solves min w^H R w subject to w^H a(θ_0) = 1, yielding w_MVDR = R^{-1}a/(a^H R^{-1}a); maximizes SINR by placing nulls at interferers.\n'
      + 'MUSIC eigendecomposes R = U_S Λ_S U_S^H + U_N Λ_N U_N^H; steering vectors at true DOAs lie in signal subspace ⊥ noise subspace; pseudo-spectrum P(θ) = 1/(||U_N^H a(θ)||²).\n'
      + 'ESPRIT avoids peak search by exploiting the rotational invariance of two overlapping subarrays: eigenvalues of the Φ = Σ₁₂ Σ₁₁^{-1} matrix give DOA estimates directly.\n'
      + 'Sparse Bayesian Learning (SBL/MSBL) formulates DOA as a sparse recovery problem on a fine grid, achieving super-resolution even with fewer snapshots than elements.',
  },

  phase_locked_loop_design: {
    summary: 'A Phase-Locked Loop (PLL) is a feedback system that locks its VCO output phase to an input reference signal, widely used for clock recovery and frequency synthesis.',
    explanation: 'PLL components: phase detector (XOR, charge pump + sample-and-hold), loop filter F(s) (proportional-integral for type II PLL), VCO with gain K_v (rad/s/V).\n'
      + 'Second-order type II PLL open-loop transfer function: G(s) = K_d K_v (τ₂ s + 1)/(τ₁ s²); closed-loop is a second-order system with natural frequency ωn and damping ζ.\n'
      + 'Phase noise of PLL output: within loop bandwidth, reference phase noise dominates; outside loop bandwidth, VCO free-running noise dominates; optimize bandwidth for minimum total noise.\n'
      + 'Charge pump PLL: current I_CP is pumped into loop filter capacitor proportional to phase error; dead-zone causes spurs; matched up/down currents minimize reference spurs.\n'
      + 'Integer-N PLL: f_out = N·f_ref; frequency resolution equals f_ref; use large f_ref for fast lock or small N for fine resolution (not both).\n'
      + 'Applications: clock and data recovery (CDR) in SerDes, carrier phase recovery in coherent optical, frequency modulation detection, and microprocessor PLL for clock multiplication.',
  },

  frequency_synthesis: {
    summary: 'Frequency synthesis generates stable, precise output frequencies from a reference oscillator using PLLs or Direct Digital Synthesis (DDS).',
    explanation: 'Integer-N PLL synthesizer: f_out = N·f_ref; comparison frequency equals f_ref, limiting frequency resolution; phase noise near carrier tracks reference noise × 20 log N.\n'
      + 'Fractional-N PLL dithers the divide modulus between N and N+1 using a sigma-delta modulator, achieving sub-f_ref frequency resolution while maintaining high comparison frequency.\n'
      + 'DDS (Direct Digital Synthesis): 32–48 bit phase accumulator increments by tuning word M each clock cycle; phase-to-amplitude LUT converts to DAC input; f_out = M·f_clk/2^N.\n'
      + 'DDS advantages: sub-Hz resolution, μs settling time, phase-continuous frequency switching; limitations: DAC spurious products (SFDR typically 70–90 dBc) and f_clk/2 maximum output.\n'
      + 'OCXO (Oven-Controlled Crystal Oscillator) provides ±10 ppb reference stability; TCXO gives ±0.5 ppm; MEMS oscillators offer smaller size at ±20 ppm.\n'
      + 'FMCW radar sweeps frequency linearly (chirp) using VCO modulation or DDS; chirp linearity directly affects range resolution and sidelobe level of the range profile.',
  },

  decimation_interpolation: {
    summary: 'Decimation and interpolation change the sampling rate of a digital signal, requiring anti-aliasing or imaging filters to maintain signal integrity.',
    explanation: 'Decimation by M: apply FIR low-pass filter with cutoff f_s/(2M) to prevent aliasing, then keep every M-th sample; output rate f_s/M; total compute: N_taps × (f_s/M) multiplies/sec.\n'
      + 'Interpolation by L: insert L−1 zeros between each sample (upsampling, spectral images at multiples of f_s), then apply FIR low-pass filter at f_s/(2L) to remove images.\n'
      + 'Arbitrary rate conversion L/M: upsample by L, filter once at min(f_s/(2L), f_s/(2M)), downsample by M; rational approximation of irrational ratios (e.g., 44.1→48 kHz = 160/147).\n'
      + 'Polyphase decomposition splits an N-tap filter h[n] into M phases h_k[n] = h[nM+k]; each polyphase filter operates at the lower rate f_s/M, saving M× computation.\n'
      + 'CIC (Cascaded Integrator-Comb) filter: R stages of integrator + comb separated by decimation by M; transfer function H(z) = ((1−z^{-RM})/(1−z^{-1}))^N; no multipliers, only adders.\n'
      + 'Multi-stage decimation (e.g., 256× as 4×4×4×4) minimizes total filter order: each stage removes a narrow band at the current Nyquist; first stage has cheapest filter.',
  },

  kalman_filter_signal: {
    summary: 'The Kalman filter is the optimal linear recursive estimator for Gaussian linear systems, minimizing mean squared error of the state estimate.',
    explanation: 'System model: x_k = F x_{k-1} + B u_k + w_k (w~N(0,Q)) and z_k = H x_k + v_k (v~N(0,R)); Kalman gain K_k = P⁻_k H^T (H P⁻_k H^T + R)^{-1}.\n'
      + 'Prediction: x̂⁻_k = F x̂_{k-1} + B u_k; P⁻_k = F P_{k-1} F^T + Q; propagates mean and covariance through system dynamics.\n'
      + 'Update: x̂_k = x̂⁻_k + K_k (z_k − H x̂⁻_k); P_k = (I − K_k H) P⁻_k; innovation z_k − H x̂⁻_k carries new information from measurement.\n'
      + 'Extended KF (EKF) linearizes nonlinear f(·) and h(·) with Jacobians F = ∂f/∂x|_{x̂}, H = ∂h/∂x|_{x̂}; accurate only for mildly nonlinear systems.\n'
      + 'Unscented KF (UKF) propagates 2n+1 sigma points through the exact nonlinear functions and recomputes mean/covariance; captures up to third-order moments with no Jacobians.\n'
      + 'Steady-state Kalman filter: when P converges to P∞ (solve DARE), precompute K∞ offline; reduces to a fixed-gain filter, computationally efficient for stationary systems.',
  },

  particle_filter_signal: {
    summary: 'The particle filter (Sequential Monte Carlo) represents arbitrary posterior distributions by a weighted set of samples, enabling nonlinear and non-Gaussian filtering.',
    explanation: 'At time k, N particles {x_k^i, w_k^i}_{i=1}^N approximate p(x_k|z_{1:k}); expectation of any function E[f(x_k)] ≈ Σ w_k^i f(x_k^i).\n'
      + 'Sequential Importance Sampling (SIS): sample x_k^i ~ q(x_k|x_{k-1}^i, z_k) and update weights w_k^i ∝ w_{k-1}^i p(z_k|x_k^i) p(x_k^i|x_{k-1}^i)/q(x_k^i|x_{k-1}^i, z_k).\n'
      + 'Bootstrap filter uses prior transition q = p(x_k|x_{k-1}) as the proposal, simplifying weight update to w_k^i ∝ p(z_k|x_k^i); easy to implement but inefficient for peaked likelihoods.\n'
      + 'Weight degeneracy: after a few steps most weight concentrates on one particle; effective sample size N_eff = 1/Σ(w_i)² triggers resampling when below N/2.\n'
      + 'Systematic resampling O(N) maps cumulative weights to N equally-spaced intervals with single random offset, preserving diversity better than multinomial resampling.\n'
      + 'Rao-Blackwellized particle filter (RBPF) marginalizes linear-Gaussian components analytically via Kalman filter per particle, reducing effective dimensionality (FastSLAM, marginalized PF).',
  },

  hmm_signal_model: {
    summary: 'Hidden Markov Models represent sequences with discrete latent states and observable emissions, foundational for speech recognition and biological sequence analysis.',
    explanation: 'HMM parameters λ = (A, B, π): transition matrix A_{ij} = P(S_t=j|S_{t-1}=i), emission probabilities B_j(o_t), initial state distribution π_i.\n'
      + 'Forward algorithm computes α_t(i) = P(o_1,...,o_t, S_t=i|λ) via recursion α_t(j) = [Σ_i α_{t-1}(i) A_{ij}] B_j(o_t); total likelihood P(O|λ) = Σ_i α_T(i) in O(N²T).\n'
      + 'Viterbi algorithm finds the most likely state sequence via DP: δ_t(j) = max_i [δ_{t-1}(i) A_{ij}] B_j(o_t); backtrack through argmax pointers for MAP state path in O(N²T).\n'
      + 'Baum-Welch (EM algorithm) re-estimates λ from observations: E-step computes forward-backward probabilities γ, ξ; M-step updates A, B, π to maximize expected log-likelihood.\n'
      + 'Continuous HMM uses Gaussian Mixture Models (GMMs) for emission probabilities B_j(o_t) = Σ_k c_{jk} N(o_t; μ_{jk}, Σ_{jk}), enabling real-valued observations.\n'
      + 'Applications: GMM-HMM acoustic models in speech recognition, protein secondary structure prediction, gesture recognition, and financial regime-switching time-series models.',
  },

  cepstral_analysis: {
    summary: 'Cepstral analysis separates the source and filter contributions in a speech signal, producing MFCC features widely used in audio and speech processing.',
    explanation: 'Speech production model: speech = glottal source * vocal tract * lip radiation; convolution in time becomes addition in log spectrum; cepstrum IFFT{log|FFT{x}|} separates them.\n'
      + 'Low quefrency cepstral components represent the slowly varying vocal tract envelope; high quefrency components represent pitch periodicity and glottal source.\n'
      + 'Mel filterbank: 20–40 triangular filters spaced on mel scale (m = 2595 log₁₀(1 + f/700)); compresses high frequencies matching human auditory resolution.\n'
      + 'MFCC computation: pre-emphasis → frame (25 ms, 10 ms hop) → Hann window → FFT → mel filterbank → log → DCT → first 12–13 cepstral coefficients.\n'
      + 'Delta (Δ) and delta-delta (ΔΔ) features append velocity and acceleration across frames, yielding 39-dimensional feature vector that captures temporal dynamics.\n'
      + 'Modern end-to-end ASR (Wav2Vec2, HuBERT) replaces hand-crafted MFCCs with learned filterbank features from raw waveform, outperforming MFCC-based systems on large data.',
  },

  blind_source_separation: {
    summary: 'Blind Source Separation (BSS) recovers independent source signals from mixed observations without knowledge of the mixing matrix.',
    explanation: 'Linear instantaneous mixing model: x(t) = A s(t), where A is unknown m×n mixing matrix; goal is to find unmixing W such that ŝ = Wx ≈ s up to scale and permutation.\n'
      + 'ICA maximizes statistical independence by maximizing non-Gaussianity (negentropy or kurtosis) of the recovered signals, exploiting the central limit theorem as prior.\n'
      + 'JADE algorithm diagonalizes a set of fourth-order cumulant matrices simultaneously (approximate joint diagonalization), reliable for sub-Gaussian and super-Gaussian sources.\n'
      + 'NMF (Non-negative Matrix Factorization) X ≈ WH, W,H ≥ 0 enforces non-negativity as physical constraint; Lee-Seung multiplicative updates minimize KL divergence or Frobenius norm.\n'
      + 'Convolutive BSS handles reverberant mixtures x(t) = Σ_τ A(τ) s(t−τ); ILRMA (Independent Low-Rank Matrix Analysis) combines ICA with low-rank source model in frequency domain.\n'
      + 'Applications: EEG/MEG artifact removal (blink and muscle artifact isolation), fetal ECG extraction from maternal recordings, audio cocktail-party problem.',
  },

  independent_component_analysis: {
    summary: 'ICA finds a linear transformation that produces maximally statistically independent components, solving the blind source separation problem under non-Gaussianity.',
    explanation: 'Problem: observe X = AS, find W = A^{-1} such that Y = WX has independent components; solvable only when at most one source is Gaussian (Gaussian is invariant to rotation).\n'
      + 'Negentropy J(y) = H(y_Gauss) − H(y) ≥ 0 measures non-Gaussianity; maximizing J(w^T x) over unit-norm w finds directions of maximum non-Gaussianity.\n'
      + 'FastICA fixed-point algorithm: w ← E{x g(w^T x)} − E{g\'(w^T x)} w, then normalize; g(u) = tanh(u) (robust to outliers) or g(u) = u exp(−u²/2) (for super-Gaussian).\n'
      + 'Whitening (ZCA/PCA pre-processing) decorrelates X and normalizes variance; reduces unmixing to orthogonal matrix W, halving the search space for FastICA.\n'
      + 'SOBI (Second-Order Blind Identification) uses time-delayed covariance matrices E[x_t x_{t+τ}^T] at multiple lags τ; robust for sources with distinct spectral profiles.\n'
      + 'Applications beyond BSS: dimensionality reduction preserving statistical structure, feature extraction for fMRI analysis, face decomposition into independent visual parts.',
  },

  spectral_estimation_adv: {
    summary: 'Advanced spectral estimation methods provide consistent, high-resolution power spectral density estimates beyond the biased periodogram approach.',
    explanation: 'Periodogram P(ω) = |X(ω)|²/N is an inconsistent estimator: variance does not decrease with N (each frequency bin variance ≈ S²(ω)); windowing reduces leakage but broadens peaks.\n'
      + 'Welch method: divide signal into overlapping K segments, window each, compute periodogram, average; variance reduced by ~K×; resolution limited by segment length L.\n'
      + 'Blackman-Tukey: estimate autocorrelation R̂[m] for |m| ≤ M << N, apply window w[m], FFT to get smoothed spectrum; bias-variance controlled by window shape and M.\n'
      + 'Autoregressive (AR) model: x[n] = −Σ_{k=1}^p a_k x[n−k] + w[n]; power spectrum S(ω) = σ²/|1 + Σ a_k e^{-jωk}|²; fit via Yule-Walker (biased R̂) or Burg (maximum entropy, numerically stable).\n'
      + 'Burg algorithm maximizes entropy of spectral estimate subject to matching estimated autocorrelation values; guarantees stability of AR model (reflection coefficients |k_m| < 1).\n'
      + 'ARMA and MUSIC provide high resolution for line spectral estimation; MUSIC eigendecomposition separates signal and noise subspaces, enabling super-resolution beyond DFT limits.',
  },

  signal_detection_theory: {
    summary: 'Signal detection theory provides the statistical framework for deciding between hypotheses based on noisy observations, optimized by the likelihood ratio test.',
    explanation: 'Binary hypothesis test: H₀ (noise only) vs H₁ (signal + noise); Bayes risk minimization yields likelihood ratio test: Λ(x) = p(x|H₁)/p(x|H₀) ≷ threshold η.\n'
      + 'Neyman-Pearson criterion: maximize P_D = P(Λ(x) > η|H₁) subject to P_FA = P(Λ(x) > η|H₀) ≤ α; solution is again the LRT with threshold set by the P_FA constraint.\n'
      + 'Matched filter maximizes output SNR for known deterministic signal s(t) in AWGN; impulse response h(t) = s(T−t); output SNR = 2E/N₀, independent of signal shape.\n'
      + 'ROC curve plots P_D vs P_FA parameterized by threshold η; area under ROC (AUC) provides a threshold-independent performance metric; ideal detector has AUC=1.\n'
      + 'CFAR (Constant False Alarm Rate) in radar: CA-CFAR estimates noise power from reference cells surrounding the test cell; threshold scales with noise estimate to maintain fixed P_FA.\n'
      + 'Sequential Probability Ratio Test (SPRT, Wald): continue collecting observations until LR exceeds upper or lower threshold; minimizes average sample number (ASN) for given error rates.',
  },

  spread_spectrum: {
    summary: 'Spread spectrum techniques spread signal bandwidth using pseudo-noise sequences or frequency hopping, providing anti-jam, low-intercept, and multiple-access capabilities.',
    explanation: 'DSSS (Direct Sequence Spread Spectrum): data bit XOR\'d with high-rate PN chip sequence (chip rate >> bit rate); received signal despread by correlating with synchronized local PN replica.\n'
      + 'Processing gain G_p = BW_spread/BW_data = T_b/T_c = 10 log₁₀(N_chips) dB; an interferer is spread by G_p at the receiver after despreading, improving SINR accordingly.\n'
      + 'FHSS (Frequency Hopping): transmitter and receiver hop through a pseudo-random sequence of frequencies; slow hop (multiple bits per hop) vs fast hop (multiple hops per bit).\n'
      + 'CDMA multiple access: assign orthogonal or near-orthogonal Walsh codes to users; synchronous downlink (base-to-mobile) uses exact orthogonality; asynchronous uplink uses MMSE receiver.\n'
      + 'Rake receiver: maximum-ratio combines L independent multipath replicas (fingers) each delayed by an integer number of chips; achieves multipath diversity instead of interference.\n'
      + '3G WCDMA (5 MHz, 3.84 Mcps) and CDMA2000 (1.25 MHz) employ DSSS with power control (inner loop 1.5 kHz, outer loop) to combat near-far problem; replaced by LTE OFDMA in 4G.',
  },

  music_doa_estimation: {
    summary: 'MUSIC is a super-resolution DOA estimation algorithm that exploits the orthogonality between signal and noise subspaces of the array covariance matrix.',
    explanation: 'Array covariance matrix R = E[x x^H] = A S A^H + σ²I; eigendecompose R = U_S Λ_S U_S^H + U_N Λ_N U_N^H where U_S spans signal subspace (d columns) and U_N noise subspace (M−d columns).\n'
      + 'True steering vectors a(θ_i) lie in the signal subspace and are orthogonal to U_N; MUSIC pseudo-spectrum P_MUSIC(θ) = ||a(θ)||² / ||U_N^H a(θ)||²; peaks locate DOAs.\n'
      + 'Resolution below Rayleigh limit λ/D is achievable given sufficient SNR and snapshots; MUSIC resolves correlated sources with spatial smoothing (cost: reduced array aperture).\n'
      + 'ESPRIT exploits rotational invariance property: two overlapping sub-arrays have identical manifold except a phase shift Φ = diag(e^{jkd sinθ_i}); eigenvalues of Φ give DOAs directly.\n'
      + 'Root-MUSIC converts peak search to polynomial rooting: substitute z = e^{jkd sinθ} into denominator, find roots closest to unit circle; avoids fine grid search.\n'
      + 'Coherent MUSIC handles fully correlated sources via spatial smoothing: average M−d+1 forward-backward averaged covariance matrices of subarray length d to restore rank.',
  },

  synchronization_digital: {
    summary: 'Digital synchronization recovers symbol timing, carrier frequency and phase from the received signal to enable coherent demodulation.',
    explanation: 'Timing synchronization recovers the optimal sampling instant; Gardner TED (Timing Error Detector): error = Re{(y[n]−y[n−1]) y*[n−1/2]}; operates on interpolated samples.\n'
      + 'Mueller-Müller TED: e[n] = Re{y[n] â*[n−1] − y[n−1] â*[n]}; uses decisions â and requires prior AFC; computationally efficient, one sample per symbol.\n'
      + 'Carrier frequency offset (CFO) estimation: for OFDM, Schmidl-Cox uses correlation of repeated preamble OFDM symbol; frequency estimate ε̂ = angle(P)/π where P = Σ r*[n] r[n+N/2].\n'
      + 'Costas loop tracks carrier phase for BPSK/QPSK: phase detector uses the decision-directed error ε = Im{y â*}; loop filter + NCO form a 2nd-order PLL in discrete time.\n'
      + 'Frame synchronization: cross-correlate received sequence with known preamble or unique word; peak of correlation (with CFAR threshold) indicates frame boundary position.\n'
      + 'Residual frequency offset causes ICI (Inter-Carrier Interference) in OFDM; phase noise causes CPE (Common Phase Error) correctable with pilot tones and per-OFDM-symbol phase correction.',
  },

  equalization_techniques: {
    summary: 'Channel equalization removes inter-symbol interference (ISI) introduced by frequency-selective multipath channels, restoring reliable symbol decisions.',
    explanation: 'Zero-Forcing equalizer: W_ZF = H^{-1} (time domain) or W_ZF(f) = 1/H(f) (frequency); forces ISI to zero but enhances noise at spectral nulls (noise enhancement problem).\n'
      + 'MMSE equalizer minimizes E[||x̂−x||²]: W_MMSE = H^H (H H^H + σ²I)^{-1}; balances ISI cancellation against noise enhancement; reduces to ZF at high SNR.\n'
      + 'DFE (Decision Feedback Equalizer): feedforward filter removes precursor ISI; feedback filter subtracts postcursor ISI using previous decisions; error propagation from wrong decisions is the main risk.\n'
      + 'OFDM trivializes equalization: cyclic prefix makes channel appear circulant, converting to N independent flat-fading channels; divide received FFT bin by estimated H[k] for scalar ZF.\n'
      + 'Turbo equalization iterates between SISO MMSE equalizer (producing soft LLRs) and SISO channel decoder (returning extrinsic LLRs as priors); 2–4 iterations approach optimal performance.\n'
      + 'Deep learning equalizers (TimNet, ViterbiNet) learn equalizer parameters from pilot data; robust to unknown channel models and hardware impairments; low-complexity inference.',
  },

  channel_estimation: {
    summary: 'Channel estimation infers the frequency-selective multipath channel coefficients from known pilot symbols to enable coherent equalization and detection.',
    explanation: 'Least Squares (LS) estimate: Ĥ_LS = X_p^{-1} Y_p where X_p = diag(pilot symbols) and Y_p = received pilots; unbiased but does not exploit channel statistics.\n'
      + 'MMSE estimator: Ĥ_MMSE = R_HH (R_HH + (1/SNR) I)^{-1} Ĥ_LS; exploits a priori channel covariance R_HH = E[H H^H]; lower MSE than LS especially at low SNR.\n'
      + 'OFDM pilot patterns: comb pilots (every K subcarriers every frame for Doppler tracking) vs block pilots (all subcarriers at known OFDM symbols for frequency interpolation).\n'
      + '2D interpolation: estimate channel at pilot positions, interpolate in both frequency (spline, DFT-based) and time (linear, Wiener for Jakes Doppler spectrum) dimensions.\n'
      + 'Sparse channel estimation: wideband channel H(τ) has L << N significant taps (sparse); compressed sensing (OMP, SOMP) recovers tap locations and values from fewer pilots (Σ N_pilots > 2L).\n'
      + 'Neural network estimators (ChannelNet, ComNet) map pilot observations to channel estimates via CNNs trained on channel statistics; generalize to channels outside training distribution with fine-tuning.',
  },

// ── Advanced Control Systems ──────────────────────────────────

  lqg_control: {
    summary: 'LQG control combines optimal state estimation (Kalman filter) with optimal state feedback (LQR) using the separation principle for linear Gaussian systems.',
    explanation: 'LQR minimizes J = ∫₀^∞ (x^T Q x + u^T R u) dt; solve the Algebraic Riccati Equation (ARE): A^T P + PA − PBR^{-1}B^T P + Q = 0 for P; gain K = R^{-1}B^T P.\n'
      + 'Kalman filter provides the optimal state estimate x̂ given noisy measurements; steady-state gain L satisfies a dual ARE involving process noise W and measurement noise V.\n'
      + 'Separation principle: optimal LQG controller = LQR(x̂) + KF(y); the two designs are independent and their combination is globally optimal for LTI Gaussian systems.\n'
      + 'LQG does not guarantee robustness margins: zero gain or phase margin possible; LQG/LTR (Loop Transfer Recovery) recovers robustness by designing Q, R to shape target Kalman filter open-loop at the plant input.\n'
      + 'Frequency-weighted LQR: augment state with output integrators for tracking, or use frequency-domain state-space weighting to achieve desired bandwidth and roll-off.\n'
      + 'Discrete-time LQG: solve discrete ARE (DARE) for P; KF prediction/update equations replace continuous Riccati; finite-horizon LQR gives time-varying gain via backward Riccati recursion.',
  },

  h_infinity_robust: {
    summary: 'H∞ robust control minimizes the worst-case input-output gain of the closed-loop system, providing robust stability and performance under bounded uncertainty.',
    explanation: 'H∞ norm ||G||_∞ = sup_ω σ_max(G(jω)); H∞ control minimizes ||T_{zw}||_∞ < γ from exogenous inputs w (disturbances) to performance outputs z over all stabilizing controllers K.\n'
      + 'Two-Riccati (Doyle-Glover-Khargonekar-Francis 1988): existence conditions and controller require solutions X∞, Z∞ to two coupled AREs; spectral radius condition ρ(X∞ Z∞) < γ² must hold.\n'
      + 'Weighting functions W_p (performance), W_u (control effort), W_Δ (uncertainty bound) shape the closed-loop frequency response; higher W_p weight at a frequency enforces smaller tracking error there.\n'
      + 'Robust stability: for multiplicative uncertainty Δ with ||Δ||_∞ ≤ 1, stable iff ||W_Δ T||_∞ < 1; nominally stable N is robustly stable iff small-gain condition holds for N∆ loop.\n'
      + 'μ-synthesis is needed for structured uncertainty (block diagonal Δ); DK iteration alternates D-scale (convex) and K design (H∞ synthesis), converging to local optimum of μ upper bound.\n'
      + 'Glover-McFarlane normalized coprime factor (NCF) formulation provides H∞ loop-shaping: shape open-loop L = G_s K, then compute robustness margin ε_max; simple, intuitive design.',
  },

  mu_synthesis_control: {
    summary: 'μ-synthesis handles systems with structured uncertainty, providing tighter robust stability and performance guarantees than standard H∞ methods.',
    explanation: 'Structured singular value μ_Δ(M) = 1/min{σ̄(Δ): Δ structured, det(I−MΔ)=0}; μ < 1 for all ω is the necessary and sufficient condition for robust stability with structured Δ.\n'
      + 'Computing exact μ is NP-hard; upper bound μ̄ = inf_D σ̄(DMD^{-1}) is computable via semidefinite programming (SDP) or LMI at each frequency, tight for ≤3 blocks.\n'
      + 'Lower bound via power iteration using random starting points; gap between upper and lower bounds indicates conservatism of the μ upper bound design.\n'
      + 'DK iteration: (D-step) minimize σ̄(D(jω) M(jω) D^{-1}(jω)) by fitting rational D-scales; (K-step) H∞ synthesis with scaled plant D_in G D_out^{-1}; repeat until convergence.\n'
      + 'D-scale fitting: fit minimum-phase stable rational transfer functions to frequency-domain D(jω) magnitude data via least-squares Bode fitting or vector fitting.\n'
      + 'Applications: flight control with aerodynamic uncertainty (F-18 HARV, X-38), precision hard disk drive with friction/resonance uncertainty, chemical reactor temperature control.',
  },

  feedback_linearization: {
    summary: 'Feedback linearization cancels nonlinearities in a system via nonlinear state feedback, transforming the closed-loop into a linear system amenable to linear design.',
    explanation: 'For a SISO system ẋ = f(x) + g(x)u, y = h(x): compute Lie derivatives L_f h, L_g L_f^{r-1} h; relative degree r is the number of differentiations until u appears explicitly.\n'
      + 'Control law u = (1/L_g L_f^{r-1} h(x))[v − L_f^r h(x)] cancels the nonlinear terms; closed-loop in new coordinates ξ = [h, L_f h, ..., L_f^{r-1} h] behaves as linear integrator chain ξ^{(r)} = v.\n'
      + 'Input-output linearization (partial feedback linearization) achieves r-dimensional linear behavior; remaining n−r states are internal dynamics driven by zero dynamics when y≡0.\n'
      + 'Zero dynamics stability is critical: if zero dynamics are asymptotically stable (minimum-phase), the full state is bounded; unstable zero dynamics make exact linearization impractical.\n'
      + 'MIMO extension: compute relative degree vector (r₁,...,r_p); decoupling matrix Δ(x) = [L_{g_j} L_{f}^{r_i-1} h_i(x)]; requires Δ non-singular for exact input-output decoupling.\n'
      + 'Applications: aircraft flight control (angle of attack regulation), underactuated robots (Acrobot, Pendubot), power converters, and chemical reactor composition control.',
  },

  differential_flatness: {
    summary: 'A differentially flat system has a set of flat outputs from which all states and inputs can be expressed algebraically, vastly simplifying trajectory planning.',
    explanation: 'System is flat if outputs y = (y₁,...,y_m) exist such that x = φ(y, ẏ, ..., y^{(q)}) and u = ψ(y, ẏ, ..., y^{(q+1)}) for some finite order q; no ODE integration needed.\n'
      + 'Quadrotor flat outputs are (x, y, z, ψ): given any smooth trajectory in these 4D flat space, the roll, pitch, and rotor speeds can be computed algebraically at each instant.\n'
      + 'Trajectory planning becomes unconstrained in flat space: parameterize y_i(t) = Σ c_{ij} B_j(t) (B-splines or polynomials), then map to feasible state-input trajectory.\n'
      + 'Minimum-snap optimization minimizes ∫||d⁴y/dt⁴||² subject to boundary conditions and optionally via-point constraints; solved as a QP in polynomial coefficients per segment.\n'
      + 'Other flat systems: differential drive robot (flat outputs: position x,y), car with trailer (flat output: rear axle position), 2D crane, induction motor.\n'
      + 'Checking flatness requires constructing the Lie-Bäcklund transformations or using the Cartan-Kähler theorem; no general algorithm exists, usually done case-by-case for specific system classes.',
  },

  iterative_learning_control: {
    summary: 'Iterative Learning Control (ILC) improves tracking performance on repeated identical tasks by updating the feedforward input using error from the previous trial.',
    explanation: 'Update law: u_{k+1}(t) = Q(q)[u_k(t) + L(q) e_k(t + d)]; Q is a robustness filter (low-pass), L is a learning filter, d is a prediction horizon for non-minimum-phase systems.\n'
      + 'P-type ILC: u_{k+1} = u_k + Γ e_k; convergence condition: spectral radius ρ(I − Γ G) < 1 over the frequency range of interest, where G is the plant frequency response matrix.\n'
      + 'Norm-optimal ILC: minimize ||e_{k+1}||²_Q + ||Δu_k||²_R per trial; gives optimal learning gain without manual tuning; extends to MIMO, constrained, and stochastic systems.\n'
      + 'Two-dimensional (2D) system theory: ILC evolves in both time t and trial k dimensions; 2D stability (Roesser, Fornasini-Marchesini) unifies analysis for both transient and trial-to-trial behavior.\n'
      + 'Robustness to model uncertainty: Q filter bandlimits learning to frequencies where model is accurate; frequency-domain inequality ||Q(I − GL)||_∞ < 1 is sufficient for convergence.\n'
      + 'Applications: robotic arm repetitive motion (semiconductor wafer handling), inkjet printing head positioning, batch chemical processes, and clinical gait rehabilitation exoskeletons.',
  },

  extremum_seeking: {
    summary: 'Extremum seeking control is a model-free real-time optimization method that drives a system to the optimum of an unknown static or slowly varying cost function.',
    explanation: 'Perturbation-based ESC: add sinusoidal dither a sin(ωt) to input; cost function output J(θ+a sin ωt) ≈ J* + (∂J/∂θ) a sin(ωt) + ...; demodulate with sin(ωt) and low-pass filter to extract gradient ∂J/∂θ.\n'
      + 'Stability analysis uses time-scale separation: dither frequency ω >> integrator bandwidth >> plant bandwidth; averaging and singular perturbation theory prove convergence to neighborhood of optimum.\n'
      + 'Gradient descent law: θ̇ = −k (output of low-pass demodulator); converges to θ* with bound O(a²) on the estimation error; Newton-based ESC uses Hessian estimate for faster convergence.\n'
      + 'Newton-based ESC: inject two sinusoids to estimate both gradient and Hessian; update θ̇ = −k Ĥ^{-1} ∇̂J; convergence rate independent of Hessian curvature (invariant to scaling).\n'
      + 'Multi-input ESC: inject N orthogonal sinusoids at different frequencies for N-dimensional gradient estimation; MIMO ESC with decoupled demodulators per input channel.\n'
      + 'Applications: maximum power point tracking (MPPT) in solar/wind, lean combustion optimization, antenna alignment, drug dosing optimization, and ABS brake torque optimization.',
  },

  distributed_control_sys: {
    summary: 'Distributed control coordinates networks of dynamical agents using local communication to achieve global objectives such as consensus, formation, or flocking.',
    explanation: 'Consensus protocol: ẋ_i = Σ_{j∈N_i} (x_j − x_i); in matrix form ẋ = −L x where L = D − A is the graph Laplacian (D: degree matrix, A: adjacency matrix).\n'
      + 'Convergence: x(t) → (1^T x(0)/n) 1 at rate λ₂(L) (algebraic connectivity / Fiedler eigenvalue); network must be connected (λ₂ > 0) for consensus to be reached.\n'
      + 'Formation control: x_i^{des} = x_centroid + r_i (fixed offset from centroid); leader-follower with virtual leader; behavioral approaches (cohesion, separation, alignment = Reynolds rules).\n'
      + 'Distributed optimization via ADMM: each agent minimizes local cost + consensus coupling term; alternates local updates (closed form or gradient step) with Lagrange multiplier updates over network.\n'
      + 'Event-triggered communication: agent only broadcasts when ||x_i(t) − x_i(t_k)||>δ; significantly reduces communication while maintaining consensus; Zeno-free with minimum inter-event time.\n'
      + 'Applications: UAV swarm coordination, platoon of autonomous vehicles (STRING stability avoids accordion effect), distributed power grid frequency regulation, sensor network coverage optimization.',
  },

  event_triggered_control: {
    summary: 'Event-triggered control transmits sensor data or computes control actions only when a triggering condition is violated, reducing communication and computation load.',
    explanation: 'Continuous event-triggered: trigger when ||e(t)||² ≥ σ ||x(t)||² where e(t) = x(t_k) − x(t) is the error since last event; guarantees closed-loop ISS (input-to-state stability).\n'
      + 'Positive inter-event time (no Zeno behavior): for the above condition with LTI system and quadratic Lyapunov function, minimum time between events τ_min > 0 is analytically provable.\n'
      + 'Periodic Event-Triggered Control (PETC): evaluate condition only at multiples of sampling period h; combines periodic sampling with event logic; easier for digital implementation.\n'
      + 'Self-triggered control: given current state x(t_k), predict when the next trigger will occur and schedule computation in advance; avoids continuous monitoring of the triggering condition.\n'
      + 'Networked control with event-triggering: Tabuada event-trigger guarantees stability despite variable inter-event delays and packet drops, analyzed via hybrid systems formalism.\n'
      + 'Dynamic event-triggering: augment triggering condition with internal dynamic variable η; η̇ = −λη + threshold − ||e||²; increases inter-event time by storing deficit in η.',
  },

  stochastic_control: {
    summary: 'Stochastic optimal control designs decision policies that minimize expected cost for systems subject to process and observation noise with probabilistic state evolution.',
    explanation: 'Stochastic LQR with E[w]=0 process noise: optimal policy is identical to deterministic LQR via certainty equivalence; minimum cost adds trace(P W) term from noise covariance.\n'
      + 'Discrete-time MDP: state x∈X, action u∈U, transition P(x\'|x,u), reward r(x,u); Bellman optimality: V*(x) = max_u [r(x,u) + γ Σ_{x\'} P(x\'|x,u) V*(x\')] for discounted horizon.\n'
      + 'Stochastic MPC formulates a scenario tree or chance-constrained program: optimize expected cost subject to P(constraint violated) ≤ ε; scenario approach draws S random realizations.\n'
      + 'Chance constraints reformulation: for Gaussian uncertainty, P(a^T x ≤ b) ≥ 1−ε ⟺ a^T μ + Φ^{-1}(1−ε)||Σ^{1/2} a|| ≤ b (tractable second-order cone constraint).\n'
      + 'CVaR (Conditional Value at Risk) as risk measure: CVaR_α(Z) = E[Z|Z ≥ VaR_α(Z)]; risk-averse control minimizes CVaR of cost rather than expectation; convex in decision variables.\n'
      + 'Approximate Dynamic Programming (ADP): fit value function V(x) ≈ θ^T φ(x) using regression over sampled state space; policy improvement via greedy one-step optimization w.r.t. Ṽ.',
  },

  model_based_rl_control: {
    summary: 'Model-based reinforcement learning learns a dynamics model from data and uses it for sample-efficient planning and policy optimization in control tasks.',
    explanation: 'Dyna architecture (Sutton): combine real experience with model-generated hallucinated experience for Q-learning updates; model allows N simulated updates per real step at negligible cost.\n'
      + 'MBPO (Janner et al.): learn probabilistic ensemble neural network dynamics model; generate short k-step rollouts from model (k=1–5 optimal); use model data to train SAC policy.\n'
      + 'PETS (Chua et al.): probabilistic ensembles with trajectory sampling (PETS); plan with random shooting or CEM over T-step horizon using ensemble to represent both aleatoric and epistemic uncertainty.\n'
      + 'iLQR / DDP (Differential Dynamic Programming): second-order trajectory optimization; backward pass computes Q-function approximation with 2nd-order terms; forward pass updates nominal trajectory; 10–100 iterations.\n'
      + 'Model error compounds over rollout horizon: short rollouts (k small) reduce compound error; trade-off between model bias and real-data sample efficiency optimized empirically per task.\n'
      + 'Distribution shift: model trained on initial data distribution may be inaccurate for states visited by improved policy; MBPO addresses via frequently adding real data; uncertainty-aware planning avoids high-uncertainty regions.',
  },

// ── Audio/Video Processing ────────────────────────────────────

  audio_coding_perceptual: {
    summary: 'Perceptual audio codecs exploit psychoacoustic masking to quantize audio with noise shaped below the auditory masking threshold, achieving high compression ratios.',
    explanation: 'Psychoacoustic model computes simultaneous and temporal masking thresholds from the input signal; any quantization noise below the threshold is inaudible.\n'
      + 'MP3 (MPEG-1 Layer III): 32-subband filterbank followed by MDCT (18 points), psychoacoustic model selects bit allocation, Huffman entropy coding; 128 kbps ≈ CD perceptual quality.\n'
      + 'AAC (Advanced Audio Coding): 1024-point MDCT with 50% overlap (128 for transients via window switching), TNS (Temporal Noise Shaping) prevents pre-echo, superior to MP3 at same bitrate.\n'
      + 'Modified DCT (MDCT) with 50% overlap and time-domain aliasing cancellation (TDAC): overlapping windows allow perfect reconstruction while providing long-transform frequency resolution.\n'
      + 'Opus codec combines SILK (LPC-based speech model) for low bitrate and CELT (transform-based) for audio; seamless switching; 6–510 kbps; IETF RFC 6716; used in WebRTC.\n'
      + 'Spatial audio coding: stereo MS coding (mid=L+R, side=L−R) exploits inter-channel redundancy; binaural (HRTF) rendering for 3D audio; Dolby Atmos uses object-based audio.',
  },

  speech_enhancement_dnn: {
    summary: 'DNN-based speech enhancement removes noise, echo, and reverberation from degraded speech using neural networks trained on large datasets of clean and noisy pairs.',
    explanation: 'Classical Wiener filter: Ŝ(ω) = [P_s(ω)/(P_s(ω)+P_n(ω))] Y(ω); requires noise PSD estimate P_n(ω) via voice activity detection and noise tracking (MCRA, IMCRA).\n'
      + 'Ideal Ratio Mask (IRM): target mask M(t,f) = P_s(t,f)/(P_s(t,f)+P_n(t,f)); DNN estimates IRM from noisy magnitude spectrogram features, applied to noisy STFT coefficients.\n'
      + 'Complex Ratio Mask (CRM): estimate complex mask on real and imaginary parts separately; preserves phase information, important for speech intelligibility and naturalness.\n'
      + 'Conv-TasNet (Luo & Mesgarani): learned encoder/decoder replace STFT; 1D temporal convolutional network (TCN) estimates mask on encoder representation; end-to-end waveform separation.\n'
      + 'DCCRN (Deep Complex Convolutional Recurrent Network): complex-valued U-Net encoder-decoder with LSTM bottleneck; complex convolutions preserve phase coherence.\n'
      + 'Metrics: PESQ (Perceptual Evaluation of Speech Quality) [-0.5, 4.5], STOI (Short-Time Objective Intelligibility) [0,1], SI-SDR (Scale-Invariant SDR) in dB; subjective MOS tests for validation.',
  },

  video_compression_h265: {
    summary: 'H.265/HEVC achieves ~50% bitrate reduction over H.264 through larger coding units, flexible block partitioning, and 33-direction angular intra prediction.',
    explanation: 'CTU (Coding Tree Unit) up to 64×64 pixels, recursively split into CUs via quad-tree; CU can be split into PUs (prediction) and TUs (transform), with flexible shapes (2N×N, N×2N, etc.).\n'
      + 'Intra prediction: 35 modes including DC, planar, and 33 angular directions at finer angles than H.264; SATD (sum of absolute transformed differences) used in mode decision RDO.\n'
      + 'Inter prediction: motion estimation over multiple reference frames; quarter-pel precision (6-tap interpolation); merge mode reuses neighboring block motion vectors to reduce syntax overhead.\n'
      + 'Transform: 4×4 to 32×32 DST/DCT with 16-bit coefficients; CABAC (Context Adaptive Binary Arithmetic Coding) entropy coder achieves ~30% better coding efficiency than CAVLC.\n'
      + 'In-loop filters: deblocking filter (DBF) smooths block boundary artifacts; Sample Adaptive Offset (SAO) corrects systematic distortions with band-offset and edge-offset.\n'
      + 'AV1 (AOMedia, royalty-free): competes with HEVC; adds additional features (CDEF, restoration filter, film grain synthesis); 30% better than HEVC; Google VP9 was predecessor.',
  },

  optical_flow_video: {
    summary: 'Optical flow estimates the apparent 2D motion field of pixels between consecutive video frames, capturing scene dynamics for video analysis and warping.',
    explanation: 'Brightness constancy assumption: I(x,y,t) = I(x+u,y+v,t+1); linearizing: I_x u + I_y v + I_t = 0 (aperture problem: one equation, two unknowns per pixel).\n'
      + 'Horn-Schunck global method adds spatial smoothness regularization: min ∫∫ (I_x u + I_y v + I_t)² + α²(||∇u||² + ||∇v||²) dxdy; solved iteratively via Euler-Lagrange equations.\n'
      + 'Lucas-Kanade local method assumes constant flow in W×W window: solve over-determined system [I_x I_y][u v]^T = −I_t for all pixels in window via weighted least squares (pseudo-inverse).\n'
      + 'FlowNet (Dosovitskiy): first DNN for optical flow; encoder-decoder with correlation layer computing cost volume between feature maps at different displacements.\n'
      + 'RAFT (Recurrent All-Pairs Field Transforms): builds 4D all-pairs correlation volume between multi-scale feature maps; iterative GRU refinement on flow field; state-of-the-art accuracy.\n'
      + 'Applications: video stabilization (warp and blend using flow), video codec motion estimation (reduce coding bits), action recognition (temporal CNN input), slow-motion video (frame interpolation).',
  },

  video_object_detection: {
    summary: 'Video object detection leverages temporal information across frames to improve accuracy and consistency over frame-by-frame application of image detectors.',
    explanation: 'Naive approach: apply image detector (YOLO, Faster R-CNN) independently per frame; suffers from flickering, misses fast-moving objects, and wastes temporal redundancy.\n'
      + 'Flow-guided feature aggregation (FGFA): warp feature maps from nearby frames to current frame using estimated optical flow; aggregate warped features before detection head.\n'
      + 'Relation networks (SELSA, MEGA): model global temporal feature relationships using attention; sample feature boxes across long temporal windows; capture context over >30 frames.\n'
      + 'Recurrent approaches: ConvLSTM or GRU propagate hidden state across frames; implicit feature memory without explicit flow estimation; end-to-end differentiable.\n'
      + 'Tracking-by-detection: run image detector sparsely, propagate detections between keyframes using KF or IoU-based assignment (SORT, ByteTrack); computationally efficient.\n'
      + 'Datasets: ImageNet VID (30 classes, ~3500 videos), YouTube-VIS (instance segmentation), COCO video; metrics: mAP per IoU threshold, temporal consistency via AP_50^{0.5:0.95}.',
  },

  action_recognition_video: {
    summary: 'Video action recognition classifies human activities in video clips by capturing appearance and motion cues across spatial and temporal dimensions.',
    explanation: 'Two-stream CNN (Simonyan & Zisserman): spatial stream processes RGB frames; temporal stream processes stacked optical flow fields; late fusion with learned weights; ImageNet pretraining critical.\n'
      + '3D convolution (C3D, I3D): 3D ConvNet learns spatiotemporal features jointly; I3D inflates 2D ImageNet pretrained weights to 3D by repeating along temporal dimension (Inception-3D).\n'
      + 'SlowFast (Feichtenhofer): Slow pathway (large spatial resolution, low frame rate) for semantic features; Fast pathway (small spatial resolution, high frame rate) for motion; lateral connections.\n'
      + 'Video Transformer (ViViT, TimeSformer): tokenize video as 3D space-time patches; factorized attention (space-then-time) reduces O(T²H²W²) complexity to O(T²+H²W²).\n'
      + 'Temporal Segment Network (TSN): uniformly sample K segments from video; aggregate snippet predictions with consensus function (average pooling); handles long videos efficiently.\n'
      + 'Datasets: Kinetics-400/600/700 (400-700 classes, 10-second clips), UCF-101, HMDB-51, Something-Something (fine-grained temporal reasoning); standard metric: Top-1 and Top-5 accuracy.',
  },

  audio_visual_speech: {
    summary: 'Audio-visual speech recognition combines lip movement video with acoustic speech signals to improve robustness in noisy environments through multimodal fusion.',
    explanation: 'Visual front-end: crop mouth ROI (typically 88×88 pixels), process with 3D-CNN (spatiotemporal) or Temporal CNN followed by ResNet to extract visual features per frame.\n'
      + 'Audio front-end: extract mel-spectrogram or Filterbank features; encode with ResNet or Transformer; both streams operate at same frame rate (typically 25 fps for video).\n'
      + 'Fusion strategies: early fusion concatenates features before shared encoder; late fusion averages decoder outputs; intermediate fusion uses cross-modal attention (preferred for AV-HuBERT).\n'
      + 'AV-HuBERT: self-supervised pretraining predicts discrete cluster assignments of masked audio-visual features; fine-tuned with CTC or seq2seq decoder; SOTA on LRS3 benchmark.\n'
      + 'McGurk effect demonstrates brain-level AV fusion: /ba/ audio + /ga/ visual → perceived /da/; proves visual speech is not merely supplementary but actively modifies phonetic perception.\n'
      + 'Applications: noisy environment ASR (cocktail party), hearing-impaired assistive devices, lip-reading surveillance, multilingual recognition (visual features somewhat language-independent).',
  },

  music_information_retrieval: {
    summary: 'Music Information Retrieval (MIR) applies signal processing and machine learning to extract meaningful musical attributes such as beat, key, chords, and genre from audio.',
    explanation: 'Chroma features (chromagram): 12-dimensional vector representing energy in each pitch class (C,C#,...,B) summed across all octaves; computed from CQT or STFT; key-invariant for transposition.\n'
      + 'Beat tracking: compute onset strength envelope (spectral flux); estimate tempo via autocorrelation or tempogram; dynamic programming alignment to a metrical grid (Ellis beat tracker).\n'
      + 'Chord recognition: chroma → HMM with chord templates as emission models and chord transition matrix learned from corpus; Viterbi decoding gives chord sequence.\n'
      + 'Singing voice separation: harmonic-percussive source separation (HPSS) as preprocessing; NUSSL, Open-Unmix, and Demucs (Wave-U-Net) for source separation with ground truth labels.\n'
      + 'Music tagging: mel-spectrogram → CNN/RNN → sigmoid output for multi-label tag prediction (mood, instrument, genre); MagnaTagATune and Million Song Dataset as standard benchmarks.\n'
      + 'Key estimation: Krumhansl-Schmuckler algorithm computes correlation of chroma with major/minor key profiles; neural CRNN approaches with key-conditioned training outperform classical.',
  },

  image_compression_jpeg2000: {
    summary: 'JPEG2000 is a wavelet-based image compression standard offering superior rate-distortion performance, lossless compression, and region-of-interest coding.',
    explanation: 'DWT (Discrete Wavelet Transform): 5/3 integer lifting (lossless) or CDF 9/7 (lossy); multi-level decomposition into LL, LH, HL, HH subbands at each scale; compact wavelet support enables efficient tiling.\n'
      + 'EBCOT (Embedded Block Coding with Optimized Truncation): each 64×64 coefficient block undergoes bitplane coding with three coding passes (significant propagation, magnitude refinement, cleanup).\n'
      + 'Tier-1 coding (MQ arithmetic coder) produces embedded bitstream per block; Tier-2 (PCRD-opt) truncates each block bitstream at the optimal point to achieve target rate/distortion.\n'
      + 'Progressive transmission: by quality (increase SNR) or by resolution (increase spatial resolution); single codestream supports multiple qualities, resolutions, and color components simultaneously.\n'
      + 'ROI (Region Of Interest) coding: MAXSHIFT method scales ROI coefficients above non-ROI; decoder can stop transmission early once ROI quality is satisfied.\n'
      + 'Comparison to JPEG: JPEG2000 outperforms JPEG at high compression ratios (no blocking artifacts, graceful degradation); standard in digital cinema (JPEG2000 in DCP), medical imaging (DICOM), remote sensing.',
  },

// ── Power Electronics & Hardware ─────────────────────────────

  zvs_zcs_converter: {
    summary: 'Zero Voltage Switching (ZVS) and Zero Current Switching (ZCS) are soft-switching techniques that eliminate switching losses by turning on or off at zero voltage or current.',
    explanation: 'Hard switching: transistor switches while V_DS and I_D are both non-zero, dissipating E = (1/2) C_oss V_DS² + t_ri V_DS I_D f_s per cycle; dominates losses above ~200 kHz.\n'
      + 'ZVS turn-on: charge resonant inductor during dead time to discharge C_oss to 0 V before gate signal; body diode conducts briefly; dV/dt-limited turn-on; energy stored in L_r recycled.\n'
      + 'ZCS turn-off: resonant capacitor C_r limits dI/dt, current resonates to zero before switch opens; used in quasi-resonant (QR) flyback and SLR converters.\n'
      + 'LLC resonant converter: two resonant frequencies f_r1 = 1/(2π√(L_r C_r)) and f_r2 = 1/(2π√((L_r+L_m)C_r)); operate above f_r1 for ZVS; gain peak near f_r1 provides voltage regulation.\n'
      + 'GaN and SiC FETs reduce C_oss and t_ri; ZVS becomes critical above 500 kHz where even small C_oss energy loss reduces efficiency significantly.\n'
      + 'Active clamping flyback achieves ZVS for primary switch by recycling leakage energy into clamp capacitor; active clamp FET turns on at ZVS during reset phase.',
  },

  resonant_tank_design: {
    summary: 'Resonant tank design for LLC and CLLC converters determines voltage gain characteristics and ZVS operating range through choice of L_r, C_r, and L_m.',
    explanation: 'LLC tank: series L_r and C_r resonant at f_r1; magnetizing inductance L_m in parallel with transformer primary; f_r2 = f_r1 × √((L_r+L_m)/L_m) < f_r1.\n'
      + 'First Harmonic Approximation (FHA): model input square wave and output rectified load as fundamental sinusoids; derive voltage gain M = V_out/V_in as function of normalized frequency f_n = f_s/f_r1.\n'
      + 'Quality factor Q = √(L_r/C_r) / R_AC where R_AC = 8n²R_L/π²; low Q gives wide gain range (low-voltage, high-current); high Q gives narrow gain range (high-voltage, telecom PSU).\n'
      + 'At f_n = 1 (operating at f_r1): gain M = n (transformer turns ratio) independent of load; optimal ZVS operating point with minimum circulating current.\n'
      + 'Below f_r2 operation: both L_r and L_m resonate with C_r, gain drops steeply; ZVS lost; avoid in design by ensuring minimum load or frequency limit.\n'
      + 'CLLC (bidirectional): symmetric tank on secondary (L_r2, C_r2) allows bidirectional ZVS operation; used in EV on-board charger V2G applications; tank elements must match for symmetric gain.',
  },

  digital_power_control: {
    summary: 'Digital power control implements voltage and current regulation algorithms in a DSP or MCU, replacing analog compensation with flexible, reconfigurable software-defined compensators.',
    explanation: 'Type III digital compensator (voltage mode): provides 180° phase boost; three poles and three zeros; designed in s-domain then discretized via bilinear (Tustin) transform with pre-warping at crossover.\n'
      + 'Type II (peak current mode): two poles, one zero at origin; simpler because inner current loop removes one pole; designed for 45° phase margin at target crossover frequency.\n'
      + 'Computational delay: DSP reads ADC at PWM period start, computes, updates duty cycle at end; one full switching period delay shifts phase −ω T_s; must account for in compensator design.\n'
      + 'ADC resolution: δV_ripple/V_pp = 1/2^N; 12-bit ADC needs reference voltage range matched to output ripple for acceptable quantization noise; differential ADC input improves noise immunity.\n'
      + 'PMBus/I2C/SPI interface: configure voltage setpoint, read telemetry (V_out, I_out, temperature, efficiency); power management controller ICs (TI UCD, ADI ADSP, Renesas) support PMBus.\n'
      + 'Adaptive/predictive control: digital allows load-current feedforward (measure I_L, pre-compensate duty cycle); reduces output voltage droop during load transients without increasing bandwidth.',
  },

  grid_tied_inverter_adv: {
    summary: 'Grid-tied inverter control synchronizes inverter output to the utility grid using a PLL and regulates active/reactive power injection via d-q frame current control.',
    explanation: 'SRF-PLL (Synchronous Reference Frame PLL): transform grid voltage to d-q frame; PI controller drives V_q → 0, locking d-axis to grid voltage; bandwidth 10–50 Hz for grid noise rejection.\n'
      + 'Current control in d-q frame: decouple cross terms with feedforward (V_d_ff = ωL I_q, V_q_ff = ωL I_d); separate PI controllers for I_d and I_q give first-order closed-loop dynamics.\n'
      + 'Power references: P = (3/2) V_d I_d, Q = −(3/2) V_d I_q; set I_d_ref = 2P_ref/(3V_d), I_q_ref = −2Q_ref/(3V_d) for unity power factor (Q=0) or reactive support.\n'
      + 'LCL filter design: inductor L_1 (inverter-side), capacitor C_f, inductor L_2 (grid-side); resonance frequency f_res = (1/2π)√((L_1+L_2)/(L_1 L_2 C_f)); damp with passive R or active damping.\n'
      + 'Anti-islanding: under/over-frequency (ROCOF) and voltage protection; active methods inject small impedance perturbation (Sandia Frequency Shift, Active Frequency Drift) to destabilize islanded grid.\n'
      + 'Grid codes: IEEE 1547-2018, IEC 61727; require LVRT (Low Voltage Ride Through) down to 0 p.u. for 150 ms, reactive current injection during fault, and power quality limits (THD < 5%).',
  },

  gan_fet_converter: {
    summary: 'GaN HEMTs enable power converters operating at multi-MHz frequencies with high efficiency through lower switching losses and near-zero reverse recovery.',
    explanation: 'GaN HEMT lateral device: 2DEG (two-dimensional electron gas) channel at AlGaN/GaN interface; inherently normally-off (e-mode) or requires cascode with Si MOSFET for enhancement mode.\n'
      + 'No body diode: reverse conduction occurs through the channel when V_GS > V_th − V_SD; results in higher conduction loss in synchronous rectification unless gate actively driven.\n'
      + 'Gate drive: ±5/0 V gate swing (vs ±15/−15 V for Si); fast dV/dt (50–100 V/ns) requires Kelvin-source connection, minimized gate loop inductance (<1 nH), and careful ESD protection.\n'
      + 'Half-bridge totem-pole PFC: eliminates diode bridge, both switches operate at high frequency in CCM; GaN enables 1–3 MHz operation; 99% efficiency demonstrated at 3.3 kW.\n'
      + 'PCB layout: minimize power loop inductance (overlapping power/return planes, decoupling capacitors at device pins); even 5 nH induces 500 V spike at 100 A/ns di/dt.\n'
      + 'Key vendors: GaN Systems (bottom-side pad), Navitas (integrated gate driver GaNFast), EPC (eGaN FET bare die); qualification: JEDEC JEP173 reliability test methods for GaN.',
  },

  active_clamping: {
    summary: 'Active clamp and synchronous rectification circuits improve flyback converter efficiency by recycling leakage energy and eliminating rectifier diode conduction losses.',
    explanation: 'Conventional flyback: leakage inductance energy dissipated in RCD snubber at each switching cycle; active clamp FET redirects leakage energy into clamp capacitor C_clamp for recycling.\n'
      + 'Active clamp flyback operation: main FET off → V_DS rises; clamp FET turns on (ZVS if properly designed) → L_lk resonates with C_clamp; main FET turns on at ZVS (V_DS = 0).\n'
      + 'Clamp capacitor C_clamp = L_lk / (V_clamp − V_in)²·(I_peak)²; voltage clamps V_DS to V_in + n·V_out + ΔV_clamp rather than unbounded spike in passive snubber.\n'
      + 'Synchronous rectification (SR): replace output diode with MOSFET (R_DS,on << V_F/I_F); for 5 V output at 20 A, SR saves ~14 W vs Schottky; controller must prevent shoot-through.\n'
      + 'SR timing: critical to detect when secondary current reaches zero (DCM boundary) to turn off SR FET before reverse current flows; SR controller ICs use primary waveform shape or secondary V_DS sensing.\n'
      + 'Combined efficiency gain: active clamp + SR enables >90% efficiency in 20–100 W USB-PD chargers (GaN primary + GaN SR); enables high power density form factors.',
  },

  voltage_mode_control: {
    summary: 'Voltage-mode and current-mode control are the two fundamental feedback architectures for switching power supply regulation, differing in what is sensed in the inner loop.',
    explanation: 'Voltage-mode control (VMC): single error amplifier compares V_out to V_ref; output modulates duty cycle via PWM comparator; requires Type III compensator to achieve adequate phase margin for LC double pole.\n'
      + 'Peak current-mode control (PCMC): inner loop compares switch peak current to V_EA (error amp output) cycle-by-cycle; outer voltage loop sets current reference; inherent switch current limiting.\n'
      + 'PCMC advantages: automatic removal of RHP zero in boost/flyback (outer loop sees current source behavior from inductor); faster transient response; input voltage feedforward via slope compensation.\n'
      + 'Slope compensation: required for D>0.5 in PCMC to prevent subharmonic oscillation; add ramp m_c ≥ m₂/2 (m₂: down-slope of inductor current) to the sensed current waveform.\n'
      + 'Average CMC (ACMC): integrates switch current over half cycle; removes sampling effect at f_s/2; used in digital control to avoid slope compensation; higher noise immunity than peak CMC.\n'
      + 'Constant-on-time (COT) and constant-off-time control: fixed on/off time with ripple-based switching; no clock, excellent transient response, but variable switching frequency complicates EMI filtering.',
  },

  power_supply_emi: {
    summary: 'Power supply EMI analysis and mitigation addresses conducted and radiated electromagnetic interference generated by high dV/dt and dI/dt switching transitions.',
    explanation: 'Differential-mode (DM) noise: current flowing between L and N lines; source is high dI/dt loop of switch and freewheeling diode; filtered by X-capacitors and differential mode choke.\n'
      + 'Common-mode (CM) noise: current flowing from L and N together through ground (LISN resistors); primary source is the switching node capacitively coupled to chassis through heat-sink Y-capacitance.\n'
      + 'LISN (Line Impedance Stabilization Network): presents 50 Ω impedance to supply at measurement point; enables repeatable conducted EMI measurement per CISPR 22/EN 55022 Class B (<66 dBμV to 5 MHz).\n'
      + 'CM choke: wound on high-permeability toroid; high impedance for CM currents, low impedance for DM currents (flux cancels for differential current); 20–80 dB attenuation.\n'
      + 'Y-capacitors: rated for AC safety (Class Y2: 250 VAC), limit leakage current (< 0.75 mA for medical); placed line/neutral to PE; small value (2.2–4.7 nF) to limit leakage.\n'
      + 'Spread-spectrum (frequency dithering): modulate switching frequency ±5% with triangular or random profile; spreads peak emissions over bandwidth, reducing CISPR quasi-peak by 6–10 dB.',
  },

  fpga_dsp_design: {
    summary: 'FPGA DSP design uses dedicated DSP slices, fixed-point arithmetic, and systolic architectures to implement high-throughput signal processing at hundreds of MHz.',
    explanation: 'DSP48E2 slice (Xilinx UltraScale): 27×18 two\'s complement multiplier, 48-bit accumulator (cascade with carry), 27-bit pre-adder; programmable opmode selects multiply-accumulate function each clock.\n'
      + 'Systolic FIR filter: chain N DSP48 slices; each adds product of tap coefficient and delayed data sample to running sum passed along chain; pipeline registers enable 500 MHz+ operation.\n'
      + 'Fixed-point Q notation: Qm.n has m integer bits (including sign) and n fractional bits; total word width = m+n; multiplication of Qm.n × Qp.q gives Q(m+p).(n+q); must truncate to fit.\n'
      + 'Overflow and saturation: two\'s complement overflow wraps (catastrophic for audio/DSP); implement saturation logic to clip at max/min value; FPGA can use carry chain for detection.\n'
      + 'CORDIC (COordinate Rotation DIgital Computer): computes sin/cos/arctan/hyperbolic functions using only shifts and adds; iterates rotation by decreasing angles arctan(2^{-i}); Q16 format, 16 iterations.\n'
      + 'Vivado/Vitis HLS compiles C++ with directives (#pragma HLS PIPELINE II=1, DATAFLOW, ARRAY_PARTITION) to RTL; analyzes data dependencies for scheduling; critical for meeting timing.',
  },

  hls_high_level_synthesis: {
    summary: 'High-Level Synthesis compiles C/C++ algorithmic descriptions into RTL hardware, automating scheduling, allocation, and binding to meet timing and throughput constraints.',
    explanation: 'HLS flow: parse C/C++ → CDFG (Control Data Flow Graph) → scheduling (assign ops to clock steps) → allocation (determine resource counts) → binding (map to specific FUs/registers) → RTL generation.\n'
      + 'Scheduling constraint: operations with data dependencies must be ordered; latency of FUs (multiply: 1-3 cycles, divide: 20+ cycles) determines minimum II (initiation interval) for loops.\n'
      + 'PIPELINE pragma with II=1: HLS unrolls the loop body overlap, accepting new data every cycle; requires enough hardware resources to hold multiple inflight iterations simultaneously.\n'
      + 'DATAFLOW pragma: enables task-level pipelining between functions/loops; intermediate streams or FIFOs connect producers to consumers; overall throughput = 1/max(stage latency).\n'
      + 'ARRAY_PARTITION pragma: partition arrays into multiple BRAMs or registers; complete partition exposes all elements simultaneously for parallel access in pipelined loops.\n'
      + 'Quality of results (QoR): HLS latency/II estimates vs post-implementation timing; optimization loop: adjust pragmas, unroll factors, bit widths; use AXI4-Stream/AXI4-Lite interfaces for SoC integration.',
  },

  hardware_verification: {
    summary: 'Hardware verification systematically validates RTL designs against functional specifications using simulation, formal methods, and coverage-driven random testing.',
    explanation: 'RTL simulation (Synopsys VCS, Cadence Xcelium, Mentor ModelSim): cycle-accurate execution of SystemVerilog/VHDL; testbench applies stimuli and checks assertions.\n'
      + 'Universal Verification Methodology (UVM): SystemVerilog class library providing sequencer-driver-monitor-scoreboard architecture; enables reuse of VIP (Verification IP) across projects.\n'
      + 'Coverage-driven verification: functional coverage (covergroup/coverpoint/cross in SV) measures which scenarios were exercised; code coverage (line, toggle, FSM, branch) via simulator instrumentation.\n'
      + 'SystemVerilog Assertions (SVA): concurrent properties check temporal behavior every clock cycle; |-> (overlapping implication), |=> (non-overlapping); JasperGold formally proves or finds counterexample.\n'
      + 'Formal verification (model checking): explores all reachable states exhaustively; bounded model checking (BMC) unwraps K cycles; abstract interpretation; effective for control logic, protocol.\n'
      + 'Equivalence checking: confirms synthesis/optimization did not alter functional behavior; combinational EC compares cone of influence; sequential EC for pipelined transformations; Synopsys Formality.',
  },

  vhdl_verilog_comparison: {
    summary: 'Verilog/SystemVerilog and VHDL are the two dominant HDLs for digital design, with SystemVerilog extending Verilog with object-oriented verification features.',
    explanation: 'Verilog: C-like syntax, implicit net types, weaker type checking; synthesizable subset: always@(*)/always_comb for combinational, always@(posedge clk) for sequential; industry standard for ASIC design.\n'
      + 'VHDL: ADA-derived strongly typed language; explicit entity-architecture-package structure; type safety prevents common wiring errors; mandated in DoD and aerospace projects; IEC 61691-1.\n'
      + 'SystemVerilog (IEEE 1800-2017): superset of Verilog; adds interfaces (bundles signals with modports), enums, structs, typedefs; logic type replaces reg/wire ambiguity.\n'
      + 'SV verification features: dynamic classes, randomization (rand/randc with constraints), virtual interfaces, program blocks, clocking blocks for testbench synchronization; foundation of UVM.\n'
      + 'Synthesis subset: only a limited synthesizable subset exists; non-synthesizable constructs (initial, force/release, $display) are simulation-only; synthesis tools (Synopsys DC, Cadence Genus) accept IEEE subsets.\n'
      + 'Mixed-language simulation: Questa, VCS allow VHDL modules instantiated in SV wrappers via foreign language interface (FLI) or direct language mixing; common in IP integration.',
  },

  fpga_partial_reconfig: {
    summary: 'FPGA Partial Reconfiguration (PR) allows a portion of the device to be reprogrammed with a new bitstream while the rest of the design continues operating.',
    explanation: 'Xilinx DFX (Dynamic Function eXchange) divides FPGA into static region (always active) and reconfigurable regions (RPs); each RP has partial bitstream loaded via ICAP or external controller.\n'
      + 'PR constraints: I/O of RP must match across all partial bitstreams (same port names and widths); Decoupler IP isolates RP boundary signals during reconfiguration to prevent glitches.\n'
      + 'Configuration time: partial bitstream is ~10–100× smaller than full bitstream; reconfiguration time proportional to bitstream size via ICAP (~100 MB/s throughput → ms-level reconfiguration).\n'
      + 'Self-reconfiguration: soft-processor inside static region reads partial bitstream from Flash/DDR, writes to ICAP; enables adaptive computing without external host intervention.\n'
      + 'Use cases: time-multiplexed accelerators (load FFT or FIR depending on task), adaptive modulation in SDR, space-grade applications (SEU mitigation via periodic reconfig), automotive OTA updates.\n'
      + 'Timing closure challenge: static-to-RP boundary timing paths must close for all partial bitstream variants; PR constraints file locks down floorplan; multi-SLR devices add extra latency at super logic region boundaries.',
  },

  embedded_real_time_linux: {
    summary: 'PREEMPT_RT extends Linux with fully preemptible kernel threads and priority-inheritance mutexes to achieve deterministic real-time response for control applications.',
    explanation: 'Standard Linux kernel: interrupt handlers run in non-preemptible context; worst-case latency >1 ms due to spinlock regions, long interrupt handler chains, and scheduler jitter.\n'
      + 'PREEMPT_RT changes: all spinlocks converted to preemptible rt_mutex (priority inheritance); hardware interrupt handlers threaded (irqthread); preemption enabled throughout kernel except minimal critical sections.\n'
      + 'SCHED_FIFO and SCHED_RR real-time scheduling classes: fixed priorities 1–99 (>0 = RT); RT task preempts normal SCHED_OTHER tasks instantly; SCHED_DEADLINE for EDF.\n'
      + 'cyclictest tool measures scheduling latency: sends SCHED_FIFO thread to sleep, measures actual vs expected wakeup time; target <50 μs worst-case latency with RT patch and CPU isolation.\n'
      + 'Kernel tuning: isolcpus=2,3 removes CPUs from scheduler; irqaffinity routes IRQs away from RT CPU; /dev/cpu_dma_latency=0 disables C-states; disable CPU frequency scaling.\n'
      + 'ROS2 with RT Linux: configure executor on isolated CPU with SCHED_FIFO priority; lock memory with mlockall(); use RT-safe data structures (lock-free queues); avoid dynamic memory allocation in RT loop.',
  },

  cortex_m_nvic: {
    summary: 'The ARM Cortex-M NVIC provides low-latency configurable interrupt handling with hardware-accelerated context save, tail-chaining, and nested preemption.',
    explanation: 'NVIC supports up to 240 external interrupts plus 16 core exceptions (HardFault, SysTick, PendSV, SVC); each interrupt has 4–8 bit configurable priority register (vendor-dependent width).\n'
      + 'Priority grouping (SCB->AIRCR PRIGROUP field 0–7): splits priority bits into preempt-priority and sub-priority fields; only preempt-priority enables nested preemption.\n'
      + 'Tail-chaining: when one ISR completes and another is pending, hardware skips full unstacking/restacking (saves 12+ cycles) by directly entering the next ISR while stack frame remains valid.\n'
      + 'Hardware context save: on interrupt entry, CPU automatically pushes R0–R3, R12, LR, PC, xPSR (and FPU registers if FPCCR.ASPEN set) to active stack; ISR runs without software prologue.\n'
      + 'SysTick: 24-bit down-counter, reloads from SYST_RVR; generates periodic interrupt for RTOS tick; typically configured to 1 ms; alternative: use TIM peripheral for higher resolution.\n'
      + 'CMSIS-RTOS v2 API standardizes RTOS interface across ARM Cortex-M devices; implementations: FreeRTOS, Zephyr, RTX; portability allows middleware (USB, TCP/IP) to target any compliant RTOS.',
  },

  adc_dac_embedded: {
    summary: 'Embedded ADC and DAC peripherals convert between analog sensor signals and digital representations for measurement, control, and signal generation.',
    explanation: 'SAR ADC: charge DAC to V_ref/2 using binary search; N comparisons for N-bit result; 1 μs/conversion typical for 12-bit at 1 MSPS; throughput limited by DAC settling and comparator decision time.\n'
      + 'Delta-Sigma ADC: 1-bit comparator oversampled at 256–512× Nyquist; noise shaping pushes quantization noise to high frequencies; digital decimation filter removes high-freq noise; achieves 16–24 bits for audio/instrumentation.\n'
      + 'Anti-aliasing filter: Nyquist requirement f_signal < f_s/2; implement with RC (1st order) or active Sallen-Key (2nd order Butterworth/Bessel) before ADC input to prevent aliasing.\n'
      + 'Trigger synchronization: configure ADC to trigger from timer output compare event; consistent timing eliminates software jitter; DMA peripheral transfers ADC result to buffer without CPU intervention.\n'
      + 'DAC options: R-2R ladder network (N bits, unbuffered), dual-slope, or dedicated DAC peripheral; PWM + external RC filter is low-cost alternative; Δ-Σ DAC for audio applications.\n'
      + 'Differential measurement: use instrumentation amp (INA128) with high CMRR (80–120 dB) for small signals riding on common-mode voltage; reject power-supply-coupled noise on sensor leads.',
  },

  signal_conditioning_emb: {
    summary: 'Signal conditioning circuits prepare raw sensor outputs for accurate ADC digitization by amplifying, filtering, level-shifting, and providing isolation.',
    explanation: 'Instrumentation amplifier (INA128, AD8221): three-op-amp topology with high CMRR (100+ dB at 60 Hz), configurable gain (1–10,000×) via single resistor R_G; measures differential signals from bridges and thermocouples.\n'
      + 'Anti-aliasing low-pass filter: Sallen-Key topology provides 2nd-order Butterworth response; cut-off f_c = f_s/2; choose Q = 0.707 for maximally flat; pole at f_c = 1/(2π RC) where R, C set by component values.\n'
      + 'Gain staging: first-stage coarse gain (op-amp) followed by fine trim; match peak signal to ADC full scale (V_REF); leave 10–20% headroom for transients; total gain = V_ADC_FS / V_sensor_peak.\n'
      + 'Level shifting: 3.3 V logic to 5 V: use MOSFET bidirectional level shifter or dedicated IC (TXS0108); optocoupler provides galvanic isolation >2.5 kV for industrial/medical; digital isolator (ADuM) faster than optocoupler.\n'
      + 'Wheatstone bridge for strain gauges: four arms, two active; output V_bridge = V_supply × (ΔR/4R_0) for small strain; bridge provides common-mode rejection; powered by precision voltage reference.\n'
      + 'Calibration: two-point (offset + gain) calibration using known stimulus; store coefficients in NVM; periodic recalibration compensates temperature drift (TCR of resistors, offset drift of op-amps).',
  },

  // ════ B13 ════


// ── CLASSICAL MECHANICS ───────────────────────────────────────

  newtonian_mechanics: {
    summary: 'Newtonian mechanics describes the motion of objects under forces using three fundamental laws: inertia, F=ma, and action-reaction. It provides the foundation for classical dynamics, from planetary orbits to everyday engineering.',
    explanation: 'Newton\'s First Law: an object remains at rest or in uniform motion unless acted upon by a net external force; defines inertial reference frames.\n\nNewton\'s Second Law: F = ma (net force = mass × acceleration); vector equation; in 3D, Fx=max, Fy=may, Fz=maz.\n\nNewton\'s Third Law: every action has an equal and opposite reaction; forces always occur in pairs acting on different bodies.\n\nFree-body diagrams: isolate a body, draw all external forces (gravity mg downward, normal force N perpendicular to surface, friction f, tension T); apply ΣF = ma in each direction.\n\nWork-Energy theorem: W_net = ΔKE = Δ(½mv²); conservative forces → potential energy (gravity: U=mgh, spring: U=½kx²); energy conservation when no non-conservative work.\n\nImpulse-Momentum: J = FΔt = Δp; conservation of momentum in isolated systems; elastic (KE conserved) vs inelastic collisions.\n\nRotational: τ = Iα (torque = moment of inertia × angular acceleration); L = Iω (angular momentum); conservation of angular momentum in isolated systems.',
  },

  lagrangian_mechanics: {
    summary: 'Lagrangian mechanics reformulates classical mechanics using generalized coordinates and the Lagrangian L = T - V, replacing Newton\'s vector forces with a single scalar function. It handles constraints naturally and is the foundation of modern theoretical physics.',
    explanation: 'Generalized coordinates q_i: any set of independent variables completely specifying system configuration; automatically incorporate constraints (pendulum: θ instead of x,y).\n\nLagrangian: L(q, q̇, t) = T(kinetic energy) - V(potential energy); scalar function, not vector.\n\nEuler-Lagrange equations: d/dt(∂L/∂q̇_i) - ∂L/∂q_i = 0; one equation per degree of freedom; equivalent to Newton\'s laws but coordinate-independent.\n\nGeneralized momentum: p_i = ∂L/∂q̇_i; if L doesn\'t depend on q_i (cyclic coordinate), then p_i is conserved → Noether\'s theorem.\n\nConstraints: holonomic (f(q,t)=0, e.g., rigid rod), non-holonomic (velocity constraints); Lagrangian handles holonomic constraints via reduced coordinates; Lagrange multipliers for constraint forces.\n\nExample: double pendulum has 2 DOF (θ₁, θ₂); Lagrangian written in terms of angles and angular velocities; Euler-Lagrange gives coupled nonlinear ODEs — exhibits chaos.\n\nVirtual work principle: δW = ΣF_i · δr_i = 0 for equilibrium; d\'Alembert\'s principle generalizes to dynamics: ΣF_i - m_i a_i) · δr_i = 0; foundation of Lagrangian approach.',
  },

  hamiltonian_mechanics: {
    summary: 'Hamiltonian mechanics reformulates classical mechanics in phase space (positions + momenta) using the Hamiltonian H = T + V. It reveals deep symmetries, connects to quantum mechanics, and is the natural framework for statistical mechanics.',
    explanation: 'Phase space: 2n-dimensional space of generalized coordinates q_i and momenta p_i = ∂L/∂q̇_i; Hamilton\'s equations: q̇_i = ∂H/∂p_i, ṗ_i = -∂H/∂q_i.\n\nHamiltonian: H(q, p, t) = Σ p_i q̇_i - L; equals total energy T + V for conservative systems; H is conserved when ∂H/∂t = 0.\n\nPoisson brackets: {A, B} = Σ(∂A/∂q_i × ∂B/∂p_i - ∂A/∂p_i × ∂B/∂q_i); evolution: dA/dt = {A, H} + ∂A/∂t; conserved quantity → {A, H} = 0.\n\nLiouville\'s theorem: phase space volume is conserved under Hamiltonian flow; incompressible flow in phase space; basis of statistical mechanics (ergodic hypothesis).\n\nCanonical transformations: change (q,p) → (Q,P) preserving Hamilton\'s equations; generating functions; action-angle variables for integrable systems.\n\nConnection to QM: Poisson bracket → (1/iℏ)[,] commutator in quantum mechanics; Hamiltonian operator generates time evolution; canonical quantization recipe.\n\nIntegrable systems: system with n DOF is integrable if n independent conserved quantities in involution ({A_i, A_j}=0); KAM theorem describes perturbation of integrable systems.',
  },

  fluid_dynamics_basics: {
    summary: 'Fluid dynamics describes the motion of liquids and gases through conservation laws for mass, momentum (Navier-Stokes), and energy. It governs aerodynamics, weather modeling, cardiovascular flow, and industrial processes.',
    explanation: 'Continuity equation: ∂ρ/∂t + ∇·(ρv) = 0 — conservation of mass; for incompressible flow: ∇·v = 0.\n\nNavier-Stokes equation: ρ(∂v/∂t + v·∇v) = -∇p + μ∇²v + ρg; LHS = inertial forces, RHS = pressure gradient + viscous forces + body forces.\n\nReynolds number: Re = ρVL/μ = inertial/viscous forces; Re << 1 → Stokes (viscous dominates, laminar), Re >> 1 → turbulent; Re_critical ≈ 2300 for pipe flow.\n\nBernoulli\'s equation: p + ½ρv² + ρgh = constant (along streamline, inviscid, steady, incompressible); explains lift, Venturi effect, pitot tube.\n\nBoundary layer: thin region near wall where viscosity dominates; no-slip condition; Blasius boundary layer solution for flat plate; separation causes drag.\n\nTurbulence: chaotic, multi-scale vortex structures; energy cascade from large to small eddies (Kolmogorov microscale ~η); DNS (Direct Numerical Simulation) resolves all scales; LES/RANS model turbulence for practical CFD.\n\nComputational fluid dynamics: finite volume method discretizes conservation laws; pressure-velocity coupling (SIMPLE algorithm); OpenFOAM, ANSYS Fluent; mesh quality critical for accuracy.',
  },

  wave_mechanics: {
    summary: 'Wave mechanics describes oscillatory disturbances propagating through media, governed by the wave equation. Waves exhibit superposition, interference, diffraction, and standing wave patterns with applications from acoustics to electromagnetism.',
    explanation: 'Wave equation: ∂²u/∂t² = c² ∂²u/∂x² (1D); solutions u(x,t) = f(x-ct) + g(x+ct) (rightward + leftward traveling waves).\n\nSinusoidal wave: u = A sin(kx - ωt + φ); k = 2π/λ (wavenumber), ω = 2πf (angular frequency), c = ω/k (phase velocity).\n\nSuperposition principle: for linear wave equation, sum of solutions is a solution; interference: constructive (in phase, amplitude adds), destructive (out of phase, amplitude cancels).\n\nStanding waves: two counter-propagating waves of equal amplitude; nodes (zero displacement) and antinodes (maximum displacement); quantized modes in bounded domain.\n\nString harmonics: fixed ends → boundary condition u(0)=u(L)=0; modes at λ_n = 2L/n, f_n = nv/2L; fundamental frequency + overtones; basis of musical instruments.\n\nDoppler effect: observer moving toward source perceives higher frequency f\' = f(c ± v_obs)/(c ∓ v_src); relativistic Doppler: f\' = f√((1-β)/(1+β)).\n\nDispersion: phase velocity depends on frequency (c(k)); dispersive medium spreads wave packet; group velocity v_g = dω/dk ≠ phase velocity c = ω/k; water waves, quantum matter waves.',
  },

  statistical_mechanics: {
    summary: 'Statistical mechanics bridges microscopic physics (atoms, molecules) and macroscopic thermodynamics by deriving thermodynamic properties from the statistical distribution of microstates, using ensembles (microcanonical, canonical, grand canonical).',
    explanation: 'Microstate vs macrostate: microstate = exact specification of all particle positions and momenta; macrostate = macroscopic quantities (T, P, V, N); many microstates correspond to one macrostate.\n\nEntropy: S = k_B ln Ω (Boltzmann); Ω = number of microstates consistent with macrostate; entropy maximized at equilibrium; second law = systems evolve toward higher entropy.\n\nCanonical ensemble: system at fixed T in contact with heat bath; partition function Z = Σ_i exp(-E_i/k_BT); probabilities P_i = exp(-E_i/k_BT)/Z; Boltzmann distribution.\n\nFree energy: Helmholtz F = -k_BT ln Z; F = U - TS; minimized at equilibrium at constant T,V; thermodynamic quantities derived: U = -∂ln Z/∂β, P = k_BT ∂ln Z/∂V.\n\nIdeal gas: Z = (V/λ_th³)^N/N! where λ_th = h/√(2πmk_BT) (thermal de Broglie wavelength); leads to pV = Nk_BT, U = (3/2)Nk_BT.\n\nBose-Einstein vs Fermi-Dirac: quantum statistics for indistinguishable particles; BE: bosons (integer spin), macroscopic occupation (condensation); FD: fermions (half-integer spin), Pauli exclusion → Fermi surface.\n\nPhase transitions: first order (latent heat, discontinuous order parameter, liquid-gas), second order (continuous order parameter, diverging correlation length, universality classes).',
  },

  chaos_theory_physics: {
    summary: 'Chaos theory studies deterministic dynamical systems exhibiting sensitive dependence on initial conditions — the butterfly effect — making long-term prediction impossible despite deterministic laws. Strange attractors, Lyapunov exponents, and fractal geometry characterize chaotic systems.',
    explanation: 'Sensitive dependence: nearby trajectories diverge exponentially; Δ(t) ≈ Δ₀ exp(λt); Lyapunov exponent λ > 0 → chaotic; largest Lyapunov exponent measures divergence rate.\n\nLogistic map: x_{n+1} = r·x_n(1-x_n); r < 3: stable fixed point; r ∈ [3,3.57]: period doubling cascade; r > 3.57: chaos; Feigenbaum constant δ ≈ 4.669 (universal for period-doubling).\n\nPhase space: trajectory in state space; attractor = set trajectory converges to; fixed point, limit cycle, torus, strange attractor (fractal, non-integer dimension).\n\nLorenz system: dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz; first chaotic system (Lorenz 1963, weather modeling); butterfly-shaped strange attractor, dimension ≈ 2.05.\n\nFractals and self-similarity: strange attractors have fractal structure; Hausdorff (fractal) dimension D_f (non-integer); Mandelbrot set, Julia sets; fractal dimension of coastlines.\n\nRoutes to chaos: period doubling (logistic map), quasi-periodicity (Ruelle-Takens), intermittency (Pomeau-Manneville); each has universal scaling properties.\n\nApplications: weather/climate limits (Lorenz: 2-week prediction horizon), turbulence, cardiac arrhythmia, population dynamics, financial markets; chaos control (OGY algorithm).',
  },

  orbital_mechanics: {
    summary: 'Orbital mechanics describes the motion of satellites and celestial bodies under gravitational forces using conic section trajectories, Kepler\'s laws, and orbital maneuvers. It is essential for spacecraft mission design.',
    explanation: 'Kepler\'s laws: (1) elliptical orbits with Sun at one focus; (2) equal areas in equal times (conservation of angular momentum); (3) T² ∝ a³ (T = period, a = semi-major axis).\n\nOrbital energy: E = -GMm/2a (negative = bound orbit); vis-viva equation v² = GM(2/r - 1/a); circular orbit: v_c = √(GM/r); escape velocity: v_e = √(2GM/r) = √2 v_c.\n\nOrbital elements: semi-major axis a, eccentricity e (0=circle, 0<e<1 ellipse, 1=parabola, e>1 hyperbola), inclination i, right ascension of ascending node Ω, argument of periapsis ω, true anomaly ν.\n\nHohmann transfer: minimum energy transfer between two circular orbits; two tangential burns; Δv₁ at departure periapsis, Δv₂ at arrival apoapsis; bi-elliptic transfer saves Δv for large radius ratios.\n\nLow Earth Orbit (LEO): 200-2000km, period ~90min; MEO: GPS/Galileo ~20200km, period 12h; GEO: 35786km, period 24h (geostationary); Molniya: highly elliptical, high-latitude coverage.\n\nLagrange points: five equilibrium points in two-body problem; L1/L2 (unstable, near smaller body, solar observations — JWST at Sun-Earth L2), L4/L5 (stable, Trojan asteroids).\n\nOrbital perturbations: J2 (Earth oblateness) causes precession, atmospheric drag in LEO causes decay, lunar/solar gravity for high orbits, radiation pressure; accounted in numerical propagators (SGP4, HPOP).',
  },

// ── ELECTROMAGNETISM ──────────────────────────────────────────


  electromagnetic_waves: {
    summary: 'Electromagnetic waves are self-sustaining oscillations of electric and magnetic fields propagating at c in vacuum. The EM spectrum spans radio waves to gamma rays, with behavior governed by Maxwell\'s equations and boundary conditions at interfaces.',
    explanation: 'Plane wave solution: E = E₀ cos(k·r - ωt + φ), B = B₀ cos(k·r - ωt + φ); E ⊥ B ⊥ k; B = E/c; transverse wave.\n\nPoynting vector: S = (1/μ₀) E×B (energy flux density, W/m²); time-averaged ⟨S⟩ = E₀²/(2μ₀c) = intensity; radiation pressure P = I/c.\n\nEM spectrum: radio (>1mm), microwave, infrared, visible (380-750nm), UV, X-ray, gamma (<0.01nm); all travel at c in vacuum, different λ and ν = c/λ.\n\nReflection/refraction (Fresnel equations): at dielectric interface, s and p polarization have different reflection coefficients; Brewster angle θ_B = arctan(n₂/n₁) → zero reflection for p-polarization.\n\nTotal internal reflection: n₁ sin θ_c = n₂ (n₁ > n₂); above critical angle θ_c, total reflection; basis of optical fiber waveguiding.\n\nPolarization: linear (fixed E direction), circular (E rotates at ω), elliptical; produced by polarizers, wave plates; birefringent materials have different n for different polarizations.\n\nBlackbody radiation: perfect absorber/emitter; Planck distribution B_λ = (2hc²/λ⁵) / (exp(hc/λk_BT)-1); Wien\'s law λ_max T = 2.898×10⁻³ m·K; Stefan-Boltzmann P = σAT⁴.',
  },

  antenna_theory: {
    summary: 'Antenna theory describes how electromagnetic energy is converted between guided waves (transmission lines) and free-space radiation. Key parameters — gain, directivity, radiation pattern, impedance matching — determine communication system performance.',
    explanation: 'Radiation: accelerating charges emit EM radiation; oscillating current in antenna → time-varying fields → propagating EM wave.\n\nHertzian dipole: infinitesimal current element; radiation pattern = donut shape (null along axis, maximum perpendicular); directivity D = 1.5 (1.76 dBi).\n\nHalf-wave dipole: λ/2 long; pattern similar to Hertzian dipole; input impedance 73+j42.5 Ω; resonant at λ/2 (or odd multiples); gain 2.15 dBi; reference for dBd measurements.\n\nAntenna parameters: gain G = D × η (directivity × radiation efficiency); EIRP = P_tx × G; reciprocity: same gain for transmit and receive.\n\nBeamwidth: 3dB beamwidth θ_3dB; narrower beam → higher gain (tradeoff); HPBW (Half-Power Beam Width) for phased arrays.\n\nImpedance matching: maximum power transfer when Z_load = Z_source*; mismatch → standing waves on transmission line; VSWR = (1+|Γ|)/(1-|Γ|) where reflection coefficient |Γ| = |(Z_L-Z_0)/(Z_L+Z_0)|; matching networks (LC, stub tuners).\n\nPhased array: N elements with controlled phase shifts; steer beam electrically without mechanical movement; AESA (Active Electronically Scanned Array) in radar and 5G base stations; null steering for interference rejection.',
  },

  optical_fiber_physics: {
    summary: 'Optical fiber transmits light via total internal reflection through a glass core with slightly lower refractive index cladding, enabling terabit-per-second data rates over transoceanic distances with minimal loss.',
    explanation: 'Step-index fiber: core (n₁ ≈ 1.48) surrounded by cladding (n₂ ≈ 1.46); NA (Numerical Aperture) = √(n₁²-n₂²) = acceptance cone half-angle.\n\nSingle-mode fiber (SMF): core diameter 8-10μm; supports only HE₁₁ mode (fundamental); eliminates modal dispersion; standard for long-haul (SMF-28, ITU-T G.652).\n\nMultimode fiber (MMF): core 50-62.5μm; multiple modes propagate at different speeds → modal dispersion → bandwidth limitation; used for short distances (data centers, <300m).\n\nAttenuation: Rayleigh scattering (1/λ⁴, dominates at short λ) + OH absorption peaks + IR absorption; lowest at 1550nm (~0.2 dB/km) → standard for long-haul DWDM.\n\nDispersion: chromatic (material + waveguide, ps/nm/km) spreads pulses when using broadband sources; dispersion-shifted fiber (DSF, zero dispersion at 1550nm); DCF (dispersion-compensating fiber) for correction.\n\nWDM (Wavelength Division Multiplexing): multiple channels on different wavelengths on single fiber; DWDM: 50GHz spacing (0.4nm), 80-160 channels × 100Gbps/channel = 8-16 Tbps/fiber.\n\nErbium-Doped Fiber Amplifier (EDFA): amplifies all WDM channels simultaneously at 1530-1565nm (C-band); pumped at 980nm or 1480nm; enables transcontinental links without O-E-O conversion.',
  },

// ── CHEMISTRY ─────────────────────────────────────────────────

  organic_chemistry_basics: {
    summary: 'Organic chemistry studies carbon-based compounds and their reactions. Carbon\'s tetravalency, hybridization, and ability to form chains enables the vast diversity of organic molecules underlying life, pharmaceuticals, and materials.',
    explanation: 'Carbon hybridization: sp³ (tetrahedral, 109.5°, alkanes), sp² (trigonal planar, 120°, alkenes/aromatics), sp (linear, 180°, alkynes); unhybridized p orbitals form π bonds.\n\nFunctional groups: alkene (C=C), alkyne (C≡C), alcohol (-OH), ether (-O-), aldehyde (-CHO), ketone (C=O), carboxylic acid (-COOH), ester (-COO-), amine (-NH₂), amide (-CONH-).\n\nReaction mechanisms: electrophilic addition (Br₂ to alkene via bromonium ion), nucleophilic substitution (SN1: carbocation intermediate, SN2: backside attack inversion), elimination (E1, E2).\n\nStereochemistry: chirality (non-superimposable mirror images, R/S configuration); enantiomers (identical physical properties, opposite optical rotation); diastereomers (different physical properties).\n\nAromaticity: benzene ring; Hückel rule 4n+2 π electrons → aromatic (n=1: benzene 6e, n=2: naphthalene 10e); aromatic stability from delocalization; electrophilic aromatic substitution (EAS).\n\nOrganic synthesis: retrosynthetic analysis (disconnect target to available starting materials); protection/deprotection of functional groups; Grignard reagent (R-MgBr) as nucleophile; cross-coupling (Suzuki, Heck, Buchwald-Hartwig).\n\nSpectroscopy: NMR (¹H and ¹³C structure elucidation, chemical shift, coupling constants), IR (functional group identification), MS (molecular weight, fragmentation pattern).',
  },

  electrochemistry: {
    summary: 'Electrochemistry studies chemical reactions driven by or producing electrical energy, governing batteries, fuel cells, electrolysis, and corrosion. The Nernst equation relates electrode potential to concentration.',
    explanation: 'Galvanic cell: spontaneous redox reaction generates electricity; anode (oxidation, negative), cathode (reduction, positive); salt bridge maintains charge balance.\n\nStandard electrode potential E°: measured vs standard hydrogen electrode (SHE, E°=0V); table of standard reduction potentials; cell E°_cell = E°_cathode - E°_anode.\n\nNernst equation: E = E° - (RT/nF) ln Q; at 25°C: E = E° - (0.0592/n) log Q; Q = reaction quotient; at equilibrium E=0 → ln K = nFE°/RT.\n\nFaraday\'s laws: moles deposited = It/nF (I=current, t=time, n=electron count, F=96485 C/mol); charge passed = current × time.\n\nLithium-ion battery: cathode LiCoO₂/LiFePO₄, anode graphite/Si; Li+ intercalation/deintercalation; SEI (Solid Electrolyte Interphase) forms on anode; energy density 150-300 Wh/kg.\n\nFuel cells: H₂ + ½O₂ → H₂O; PEMFC (Proton Exchange Membrane, 80°C, automotive), SOFC (Solid Oxide, 800°C, stationary power); theoretical efficiency 83%, practical 40-60%.\n\nCorrosion: electrochemical oxidation of metals; galvanic corrosion (dissimilar metals in contact with electrolyte); protection via sacrificial anode (Zn for steel), passivation layer (stainless steel Cr₂O₃), cathodic protection (impress current).',
  },

  polymer_chemistry: {
    summary: 'Polymer chemistry studies large macromolecules composed of repeating monomer units. Understanding polymerization mechanisms, molecular weight distributions, and structure-property relationships is fundamental to materials science and industry.',
    explanation: 'Polymerization: chain-growth (addition) — radical, cationic, anionic mechanisms; ring-opening polymerization; step-growth (condensation) — nylon, polyester; living polymerization (RAFT, ATRP) enables controlled molecular weight and architecture.\n\nMolecular weight: Mn (number-average), Mw (weight-average); PDI = Mw/Mn (dispersity, 1 for perfectly uniform, >2 for broad distribution); affects mechanical properties.\n\nPolymer morphology: amorphous vs crystalline; Tg (glass transition temperature) — rubber below, glassy above; Tm (melting temperature) for semicrystalline; crystallinity affects transparency, toughness.\n\nCommon polymers: polyethylene (PE, packaging), polypropylene (PP, containers), polystyrene (PS, foam), PVC (pipes), PTFE (non-stick), PET (bottles/fibers), nylon-6,6 (structural).\n\nCopolymers: alternating (A-B-A-B), random, block (A-A-A-B-B-B), graft; block copolymers microphase separate into nanostructured domains (lamellar, cylindrical, spherical).\n\nRubber and elastomers: natural rubber (polyisoprene), vulcanization (S-S crosslinks via sulfur), synthetic rubbers (SBR, EPDM, silicone); elastic deformation via entropy (stretched chains have lower entropy).\n\nConjugated polymers: alternating single-double bonds along backbone; delocalized π electrons enable conductivity; PEDOT:PSS (transparent electrode), P3HT (organic solar cell), polyacetylene (Nobel 2000).',
  },

  reaction_kinetics: {
    summary: 'Chemical kinetics quantifies how fast reactions occur and what factors control rate — concentration, temperature, catalysis, and mechanism. The Arrhenius equation and transition state theory provide molecular-level understanding of reaction rates.',
    explanation: 'Rate law: r = k[A]^m[B]^n; k = rate constant; m,n = partial orders (determined experimentally, not from stoichiometry); overall order = m+n.\n\nIntegrated rate laws: 0th order: [A] = [A]₀ - kt; 1st order: ln[A] = ln[A]₀ - kt, t₁/₂ = ln2/k; 2nd order: 1/[A] = 1/[A]₀ + kt.\n\nArrhenius equation: k = A·exp(-E_a/RT); A = pre-exponential factor (collision frequency × steric factor); E_a = activation energy; ln k vs 1/T gives straight line (Arrhenius plot).\n\nTransition state theory (Eyring): k = (k_BT/h) exp(-ΔG‡/RT); ΔG‡ = ΔH‡ - TΔS‡; activation enthalpy + entropy determine rate; transition state is highest point on energy surface.\n\nCatalysis: provides alternative lower-E_a pathway; catalyst not consumed; homogeneous (same phase), heterogeneous (solid catalyst, gas/liquid reactants); enzyme kinetics: Michaelis-Menten v = Vmax[S]/(Km+[S]).\n\nReaction mechanisms: elementary steps (unimolecular, bimolecular, rarely termolecular); rate-determining step (slowest); steady-state approximation for reactive intermediates; chain reactions (initiation, propagation, termination).\n\nChemical equilibrium: Keq = k_f/k_r = exp(-ΔG°/RT); Le Chatelier\'s principle (perturb equilibrium → system shifts to counteract); temperature, pressure, concentration effects.',
  },

  spectroscopy_analytical: {
    summary: 'Spectroscopy analyzes matter by measuring its interaction with electromagnetic radiation at different frequencies, enabling structural identification, quantification, and real-time monitoring of chemical and biological systems.',
    explanation: 'UV-Vis spectroscopy: electronic transitions (π→π*, n→π*); Beer-Lambert law: A = εlc (absorbance = molar absorptivity × path length × concentration); used for enzyme kinetics, DNA quantification (A260).\n\nInfrared (IR) spectroscopy: molecular vibration modes (stretching, bending) absorb specific IR frequencies; fingerprint region 500-1500 cm⁻¹ unique to molecule; functional group identification: O-H (~3300), C=O (~1720), N-H (~3300 cm⁻¹).\n\nNMR spectroscopy: nuclei in magnetic field absorb RF at specific frequency (Larmor frequency ω = γB₀); chemical shift δ (ppm) reveals electronic environment; J-coupling (spin-spin coupling) shows adjacent protons; 2D NMR (COSY, NOESY, HSQC) for structure elucidation.\n\nMass spectrometry: ionize molecule (ESI, MALDI, EI), separate ions by m/z (magnetic sector, TOF, quadrupole, ion trap); molecular ion [M+H]⁺; fragmentation pattern for structure; high-resolution MS for molecular formula.\n\nRaman spectroscopy: inelastic light scattering; complementary to IR (IR-active = change in dipole, Raman-active = change in polarizability); non-destructive, works through glass/water; SERS enhances 10⁶-fold via plasmonic nanoparticles.\n\nX-ray crystallography: diffraction from crystal lattice reveals 3D atomic structure; Bragg\'s law: nλ = 2d sinθ; synchrotron sources; solved structures of DNA, proteins, pharmaceuticals; CSD (Cambridge Structural Database) >1M structures.\n\nAtomic spectroscopy: AAS (Atomic Absorption, element quantification, trace metals), ICP-MS (multi-element trace analysis at ppb-ppt levels), XRF (X-ray fluorescence, elemental composition of solids).',
  },

  quantum_chemistry: {
    summary: 'Quantum chemistry applies quantum mechanics to chemical systems, calculating electronic structure, bonding, and reaction energetics from first principles. DFT (Density Functional Theory) enables practical calculations for molecules and materials.',
    explanation: 'Schrödinger equation: Ĥψ = Eψ; Hamiltonian contains kinetic energy of electrons/nuclei + Coulomb interactions; exact solution only for hydrogen-like atoms.\n\nMolecular orbital theory: LCAO (Linear Combination of Atomic Orbitals); bonding MO (lower energy, constructive overlap) + antibonding MO (*); bond order = (bonding e - antibonding e)/2.\n\nHF (Hartree-Fock): mean-field approximation; each electron in mean field of all others; neglects electron correlation; good for structure, poor for reaction energies; basis sets (STO-3G, 6-311G*, cc-pVDZ).\n\nPost-HF methods: MP2 (2nd order Møller-Plesset perturbation theory), CCSD(T) (coupled cluster, gold standard, scales O(N⁷)); accurate but expensive for large systems.\n\nDFT (Density Functional Theory): ground state energy is functional of electron density ρ(r); Hohenberg-Kohn theorem; Kohn-Sham equations; exchange-correlation functional (LDA, GGA:PBE, hybrid:B3LYP); practical O(N³) scaling.\n\nBasis sets: mathematical functions representing atomic orbitals; minimal (STO-nG), split-valence (6-31G*), correlation-consistent (cc-pVTZ); larger basis → more accurate but more expensive.\n\nApplications: drug binding affinity prediction, catalyst design, materials band gap calculation, reaction mechanism mapping; Gaussian, ORCA, VASP software packages.',
  },

// ── BIOLOGY & BIOMEDICAL ──────────────────────────────────────

  molecular_biology: {
    summary: 'Molecular biology studies the molecular mechanisms of biological processes — DNA replication, transcription, translation — forming the central dogma: DNA → RNA → protein. Techniques like PCR, gel electrophoresis, and sequencing are its core tools.',
    explanation: 'Central dogma: DNA → (transcription) → mRNA → (translation) → protein; DNA contains the master blueprint; RNA is the working copy; ribosomes translate RNA into protein.\n\nDNA replication: semi-conservative; helicase unwinds double helix; primase synthesizes RNA primer; DNA polymerase (5\'→3\' synthesis, 3\'→5\' proofreading); leading strand continuous, lagging strand Okazaki fragments; ligase seals nicks.\n\nTranscription: RNA polymerase binds promoter (TATA box, -10/-35 in prokaryotes); unwinds DNA locally; synthesizes pre-mRNA 5\'→3\'; termination at terminator sequence; eukaryotes: 5\' cap + poly-A tail + splicing introns.\n\nTranslation: mRNA binds ribosome at AUG start codon; tRNA with anticodon brings amino acid; peptide bond formation in peptidyl transferase center (23S rRNA = ribozyme); translocation; stop codon releases peptide.\n\nPCR (Polymerase Chain Reaction): denature (95°C), anneal primers (55-65°C), extend (72°C, Taq polymerase); exponential amplification 2^n copies per cycle; 30 cycles → 10⁹ fold amplification; RT-PCR for RNA, qPCR for quantification.\n\nGel electrophoresis: separate DNA/protein by size in agarose/polyacrylamide gel under electric field; smaller fragments migrate faster; EtBr staining or SYBR for visualization; molecular weight ladder for size comparison.\n\nNext-generation sequencing: fragmented DNA ligated to adapters, amplified on flow cell, sequenced by synthesis (Illumina: reversible terminators, ~150bp reads); millions of reads in parallel; applications: whole-genome sequencing, RNA-seq, ChIP-seq.',
  },

  genetics_genomics: {
    summary: 'Genetics studies heredity and variation through genes and alleles, while genomics analyzes complete genomes using high-throughput sequencing and bioinformatics to understand function, evolution, and disease.',
    explanation: 'Mendelian genetics: dominant/recessive alleles; segregation (diploid organism passes one allele per gamete); independent assortment (different chromosomes); Punnett squares predict offspring ratios.\n\nMutation types: point (substitution, missense, nonsense, silent), insertion/deletion (frameshift), large-scale (inversion, translocation, duplication, deletion, copy number variation).\n\nLinkage and recombination: genes on same chromosome are linked; recombination (crossing-over in meiosis I) reshuffles alleles; recombination frequency = map distance (cM); linkage maps.\n\nGenome-wide association study (GWAS): genotype millions of SNPs (Single Nucleotide Polymorphisms) in cases vs controls; statistical association with phenotype; identify disease risk variants; polygenic risk scores.\n\nRNA-seq: mRNA extracted, reverse-transcribed to cDNA, sequenced; counts mapped to genome; differential expression analysis (DESeq2, edgeR); reveals splicing, allele-specific expression.\n\nPhylogenetics: reconstruct evolutionary history from sequence differences; distance matrix (Neighbor-Joining), parsimony, maximum likelihood (RAxML); molecular clock; BEAST for Bayesian phylogenetics.\n\nPersonalized medicine: pharmacogenomics (drug metabolism variants CYP2D6, CYP2C19); cancer genomics (somatic mutations, tumor mutational burden for immunotherapy); prenatal sequencing; newborn screening.',
  },

  protein_structure: {
    summary: 'Proteins fold from a linear amino acid sequence into precise 3D structures that determine function. The four levels of structure — primary, secondary, tertiary, quaternary — emerge through non-covalent interactions and disulfide bonds.',
    explanation: 'Primary structure: amino acid sequence; 20 amino acids with varying side chains (hydrophobic, polar, charged, aromatic, special); peptide bond (planar, resonance-stabilized).\n\nSecondary structure: local regular patterns stabilized by backbone H-bonds; α-helix (3.6 residues/turn, H-bond between i and i+4), β-sheet (parallel or antiparallel strands H-bonded laterally).\n\nTertiary structure: overall 3D fold; hydrophobic core (hydrophobic residues buried, polar exposed); stabilized by H-bonds, ionic interactions, van der Waals, disulfide bonds (Cys-Cys in oxidizing environment).\n\nQuaternary structure: assembly of multiple polypeptide chains (subunits); hemoglobin (2α+2β tetramers), antibody (2 heavy + 2 light chains).\n\nProtein folding: Levinthal paradox (astronomical conformations to search); chaperones (Hsp70, Hsp90, GroEL/GroES) prevent aggregation; folding funnel energy landscape; misfolding → aggregation → prion diseases, Alzheimer\'s amyloid.\n\nAlphaFold2 (DeepMind, 2020): transformer + MSA (multiple sequence alignment) + triangular attention → near-experimental accuracy for structure prediction; 200M structures in AlphaFold Database.\n\nStructural determination: X-ray crystallography (2Å resolution, requires crystal), cryo-EM (near-native conditions, works for large complexes), NMR (solution state, <50kDa); Protein Data Bank (PDB) >200K structures.',
  },

  enzyme_kinetics: {
    summary: 'Enzyme kinetics quantifies how enzymes catalyze reactions by binding substrate at the active site and lowering activation energy. Michaelis-Menten kinetics describes substrate-rate relationships; inhibition modifies this behavior.',
    explanation: 'Michaelis-Menten mechanism: E + S ⇌ ES → E + P; assumptions: [ES] steady-state, [E]_total << [S]; rate v = Vmax[S]/(Km + [S]).\n\nKm (Michaelis constant): [S] at which v = Vmax/2; ≈ dissociation constant of ES when k_cat << k_{-1}; indicates enzyme-substrate affinity (lower Km → tighter binding).\n\nVmax = k_cat × [E]_total; k_cat = turnover number (reactions/enzyme/second); catalytic efficiency = k_cat/Km (upper limit = diffusion rate ~10⁸-10⁹ M⁻¹s⁻¹).\n\nLineweaver-Burk plot: 1/v vs 1/[S]; straight line; y-intercept = 1/Vmax, x-intercept = -1/Km; useful for inhibition pattern identification.\n\nCompetitive inhibition: inhibitor binds active site (competes with substrate); apparent Km increases, Vmax unchanged; overcome by high [S]; slope increases in LB plot.\n\nUncompetitive inhibition: inhibitor binds ES complex only; reduces both Km and Vmax; parallel lines in LB plot; seen in multi-substrate reactions.\n\nAllosteric regulation: binding at non-active site changes enzyme activity; sigmoidal v vs [S] (Hill equation); positive cooperativity (hemoglobin O₂ binding); feedback inhibition (product inhibits first enzyme in pathway).',
  },

  bioinformatics_basics: {
    summary: 'Bioinformatics develops computational methods for analyzing biological sequences, structures, and -omics data. Sequence alignment, BLAST searching, phylogenetics, and machine learning are foundational tools for modern biology.',
    explanation: 'Sequence alignment: global (Needleman-Wunsch, aligns entire sequences), local (Smith-Waterman, finds best local match); dynamic programming; substitution matrix (BLOSUM62 for proteins, +1/-1 for DNA).\n\nBLAST (Basic Local Alignment Search Tool): heuristic fast local alignment; seeds with k-mer matches, extends alignment; E-value (expected random matches); BLASTP (protein), BLASTN (nucleotide), BLASTX (translated).\n\nHidden Markov Models: probabilistic framework for sequence profile analysis; profile HMM (Pfam) describes conserved protein domains; Viterbi algorithm finds most likely path; used for gene prediction, multiple alignment.\n\nGenome assembly: de novo assembly of short reads; overlap-layout-consensus (OLC for long reads), de Bruijn graph (for short reads, SPAdes/Velvet); N50 metric for contig quality; scaffolding with long reads or Hi-C.\n\nVariant calling: align reads to reference genome (BWA-MEM, STAR for RNA); call SNPs/indels (GATK HaplotypeCaller, DeepVariant); filter by depth, quality, allele frequency; annotate with functional impact (VEP, SnpEff).\n\nProtein structure prediction: homology modeling (MODELLER, Swiss-Model) uses template structure; AlphaFold2 (MSA + deep learning, 2020 CASP14 breakthrough); Rosetta (energy minimization + fragments).\n\nNetwork biology: protein-protein interaction networks (STRING database); Gene Ontology (GO) enrichment analysis; pathway analysis (KEGG, Reactome); network centrality identifies hub proteins; community detection.',
  },

  crispr_gene_editing: {
    summary: 'CRISPR-Cas9 is a programmable gene editing tool derived from bacterial adaptive immunity. A guide RNA directs Cas9 nuclease to a specific genomic site for precise cuts, enabling gene knockout, correction, or insertion.',
    explanation: 'Mechanism: sgRNA (single guide RNA) with 20nt spacer + scaffold; Cas9-sgRNA complex scans genome for PAM sequence (NGG for SpCas9); binds complementary target, R-loop formation; Cas9 cleaves both strands → DSB.\n\nRepair pathways: NHEJ (Non-Homologous End Joining) → indels → frameshift → gene knockout; HDR (Homology-Directed Repair) with donor template → precise insertion or correction (requires donor DNA, less efficient).\n\nOff-target effects: sgRNA can bind similar sequences; minimize by: truncated gRNAs, high-fidelity Cas9 variants (eSpCas9, HiFi Cas9), paired nickases (D10A Cas9 pairs), off-target prediction (Cas-OFFinder, CRISPOR).\n\nDelivery: plasmid transfection (stable, high off-target risk), RNP (ribonucleoprotein complex, lower off-target, no integration risk), viral vectors (AAV, lentivirus for in vivo), LNP (lipid nanoparticles for in vivo liver).\n\nBase editing: CBE (cytosine base editor: C→T without DSB), ABE (adenine base editor: A→G); more precise than traditional editing; window ~4-8 in protospacer; limited to transitions.\n\nPrime editing: pegRNA encodes both guide sequence and desired edit as reverse transcriptase template; precise insertions, deletions, all 12 substitutions; no DSB; lower efficiency than base editing.\n\nApplications: sickle cell disease cure (ex vivo HSC editing), cancer immunotherapy (CAR-T cell engineering), plant breeding, diagnostic applications (SHERLOCK, DETECTR), functional genomics screens.',
  },

  medical_imaging_physics: {
    summary: 'Medical imaging modalities — X-ray, CT, MRI, ultrasound, PET — use different physical phenomena to create diagnostic images of anatomy and function. Understanding the underlying physics enables optimal acquisition and artifact identification.',
    explanation: 'X-ray/CT: X-ray photons attenuate by photoelectric effect and Compton scattering in tissue; transmitted photons hit detector; CT rotates source+detector → filtered back-projection or iterative reconstruction → 3D volume.\n\nMRI: hydrogen nuclei (protons) precess at Larmor frequency ω = γB₀ in magnetic field; RF pulse at Larmor frequency tips magnetization; T1 (longitudinal relaxation, fat bright on T1), T2 (transverse relaxation, fluid bright on T2); gradient coils for spatial encoding.\n\nFourier encoding: gradient fields map position to frequency; k-space data (Fourier space) accumulated; 2D/3D FFT reconstructs image; k-space trajectory affects contrast and speed (EPI for fMRI, radial for motion).\n\nUltrasound: piezoelectric crystal emits 2-20MHz sound pulses; pulse-echo timing gives depth (d = ct/2); Doppler mode measures blood velocity from frequency shift; no ionizing radiation, real-time.\n\nPET (Positron Emission Tomography): F-18 FDG (fluorodeoxyglucose) accumulates in metabolically active tissue; positron + electron → 2 gamma rays (511 keV) at 180°; coincidence detection localizes annihilation; combined PET/CT.\n\nContrast agents: iodinated contrast for CT (enhances blood vessels, lesions), Gadolinium for MRI (T1 shortening), ultrasound microbubbles (resonant at MHz, echogenic), F-18 FDG for PET.\n\nRadiation dose: CT ~5-20 mSv, X-ray ~0.1 mSv, PET ~7 mSv; background radiation ~3 mSv/year; As Low As Reasonably Achievable (ALARA) principle; MRI/ultrasound: no ionizing radiation.',
  },

  systems_biology: {
    summary: 'Systems biology integrates experimental data with mathematical modeling to understand complex biological networks — gene regulatory, metabolic, and signaling — as dynamic systems exhibiting emergent behaviors like oscillations, switches, and robustness.',
    explanation: 'Network motifs: recurring subgraph patterns in biological networks; feedforward loop (FFL: A→B, A→C, B→C), negative feedback (oscillation, homeostasis), positive feedback (bistability, cell fate switching).\n\nOrdinary differential equations (ODEs): dx_i/dt = f_i(x, p); x = concentrations, p = rate constants; mass-action kinetics, Hill functions for cooperative binding; numerical simulation (CVODE, MATLAB ode45).\n\nBoolean networks: genes as binary (on/off); state transitions from logic rules; attractor states = cell types; robustness to perturbations; Kauffman NK model.\n\nMetabolic flux analysis: stoichiometric matrix S (m×n, m metabolites, n reactions); steady state: S·v = 0; flux balance analysis (FBA) maximizes objective (growth) subject to constraints; COBRA toolbox.\n\nSignaling cascades: phosphorylation relays (MAPK: Ras→Raf→MEK→ERK); ultrasensitivity via kinase-phosphatase zero-order kinetics (Goldbeter-Koshland switch); bistability from positive feedback.\n\nStoichiometric modeling: genome-scale models (RECON3D: 13,543 reactions); condition-specific constraints from omics data; prediction of drug targets, auxotrophies, metabolic engineering.\n\nSingle-cell analysis: scRNA-seq resolves cell-to-cell heterogeneity; pseudotime trajectory inference (Monocle, PAGA); perturbation-response (Perturb-seq); spatial transcriptomics (Visium, MERFISH) preserves tissue context.',
  },

// ── MATERIALS SCIENCE ─────────────────────────────────────────

  crystal_structure: {
    summary: 'Crystal structure describes the periodic arrangement of atoms in a solid, characterized by a lattice (mathematical points) and a basis (atoms at each point). Crystal symmetry determines physical properties from conductivity to optical behavior.',
    explanation: 'Bravais lattices: 14 distinct lattice types in 3D (cubic: SC/BCC/FCC, tetragonal, orthorhombic, hexagonal, trigonal, monoclinic, triclinic).\n\nFCC (Face-Centered Cubic): atoms at corners + face centers; close-packed planes {111}; coordination number 12; metals: Cu, Al, Ni, Au, Ag; packing efficiency 74%.\n\nBCC (Body-Centered Cubic): atoms at corners + center; coordination number 8; metals: Fe (bcc at RT), W, Cr, Mo; packing 68%; less close-packed than FCC.\n\nMiller indices (hkl): describe crystal planes; reciprocals of intercepts on a,b,c axes, reduced to integers; {100} planes in cubic, ⟨110⟩ directions; X-ray diffraction uses Miller indices via Bragg\'s law.\n\nReciprocal lattice: Fourier transform of crystal lattice; Brillouin zone = Wigner-Seitz cell of reciprocal lattice; k-space of electronic band structure; X-ray diffraction peaks at reciprocal lattice vectors.\n\nDefects: point defects (vacancy, interstitial, substitutional impurity), line defects (dislocations: edge, screw — mobile under stress → plastic deformation), planar defects (grain boundaries, stacking faults), volume (voids).\n\nX-ray diffraction: Bragg\'s law 2d sinθ = nλ; different d-spacings for different planes; powder diffraction (Debye-Scherrer) for polycrystalline; Rietveld refinement for structure determination from powder data.',
  },

  semiconductor_physics: {
    summary: 'Semiconductor physics describes electronic conduction in materials with band gaps of ~0.1-3 eV. Doping, carrier transport, p-n junctions, and heterostructures are the basis of all transistors, solar cells, LEDs, and lasers.',
    explanation: 'Band structure: valence band (filled) + band gap (E_g) + conduction band (empty at 0K); semiconductor E_g 0.1-3 eV; direct gap (GaAs, optical transitions) vs indirect (Si, Ge, phonon required).\n\nIntrinsic carriers: n_i = √(N_c × N_v) × exp(-E_g/2k_BT); n_i(Si,300K) ≈ 10¹⁰ cm⁻³; both electrons and holes contribute equally.\n\nDoping: n-type (donor, e.g., P in Si, donates electron to conduction band), p-type (acceptor, e.g., B in Si, accepts electron = creates hole); majority/minority carriers.\n\nCarrier transport: drift (J = qnμE), diffusion (J = qD∇n); Einstein relation D = μk_BT/q; minority carrier lifetime τ, diffusion length L = √(Dτ) critical for solar cells.\n\np-n junction: built-in potential V_bi; depletion width W ∝ 1/√N; forward bias reduces barrier (exponential current J = J_0(exp(qV/k_BT)-1)); reverse bias increases barrier (small leakage); diode I-V characteristic.\n\nMOSFET: Metal-Oxide-Semiconductor Field-Effect Transistor; gate voltage modulates inversion channel; threshold voltage V_t; I_D = μC_ox(W/L)(V_GS-V_t)V_DS (linear) or ½μC_ox(W/L)(V_GS-V_t)² (saturation).\n\nBandgap engineering: heterostructures (AlGaAs/GaAs); quantum wells (2D confinement), quantum dots (3D confinement, discrete energy levels); strained layers modify band structure; used in LEDs, laser diodes, HEMTs.',
  },

  mechanical_properties_materials: {
    summary: 'Mechanical properties describe how materials respond to applied loads — elastic (reversible) and plastic (permanent) deformation, fracture, and fatigue. Stress-strain relationships and microstructure determine strength, toughness, and failure modes.',
    explanation: 'Stress-strain curve: elastic region (linear, Hooke\'s law σ=Eε, E=Young\'s modulus), yield point (onset of plastic deformation, 0.2% offset yield strength), plastic region (work hardening), ultimate tensile strength (UTS), fracture.\n\nElastic constants: Young\'s modulus E (stiffness in tension), shear modulus G = E/2(1+ν), Poisson\'s ratio ν (lateral/axial strain ratio); isotropic materials: G = E/2(1+ν).\n\nDislocations and plasticity: edge dislocation movement along slip plane under shear stress; critical resolved shear stress τ_crss; Frank-Read source generates dislocation loops; work hardening from dislocation interactions.\n\nStrengthening mechanisms: solid solution (alloying elements), precipitation hardening (coherent precipitates block dislocations, age hardening of Al alloys), grain boundary strengthening (Hall-Petch: σ_y ∝ d^(-1/2)), strain hardening.\n\nFracture mechanics: stress intensity factor K_I = σ√(πa)·f(geometry); fracture when K_I ≥ K_Ic (fracture toughness); Griffith criterion (E_surface vs strain energy release); brittle (ceramics) vs ductile fracture (metals).\n\nFatigue: cyclic loading causes crack initiation at surface defects → crack propagation → final fracture; S-N (Wöhler) curve; endurance limit (steel has limit, aluminum does not); Paris law da/dN = C(ΔK)^m for crack growth.\n\nCreep: time-dependent deformation at T > 0.4T_m under sustained load; primary-secondary-tertiary stages; dislocation climb, grain boundary sliding; Larson-Miller parameter for lifetime prediction; critical for turbine blades.',
  },

  nanomaterials_synthesis: {
    summary: 'Nanomaterials (1-100 nm scale) exhibit unique size-dependent properties — quantum effects, high surface area, altered optical/electronic behavior — enabling applications in catalysis, medicine, electronics, and energy.',
    explanation: 'Size effects: surface-to-volume ratio ∝ 1/d → high reactivity; quantum confinement when size ≈ de Broglie wavelength → discrete energy levels; quantum dots emit size-tunable colors (E_g increases as size decreases).\n\nBottom-up synthesis: wet chemistry (nucleation + growth control by ligands, temperature, precursor concentration); Turkevich method for Au nanoparticles (citrate reduction); sol-gel for metal oxide nanoparticles.\n\nTop-down synthesis: ball milling (mechanical grinding), lithography (photolithography, e-beam), laser ablation; limited resolution compared to chemical synthesis.\n\nCarbon nanomaterials: fullerene C60 (soccer ball, sp² carbon, 0D), carbon nanotubes (1D, armchair: metallic, zigzag: semiconductor), graphene (2D, σ_e=10⁸ S/m, E=1 TPa, transparent), carbon nanofibers.\n\nCharacterization: TEM (transmission electron microscopy, atomic resolution), SEM (surface morphology), AFM (surface roughness, force measurement), XRD (crystal structure), DLS (dynamic light scattering, hydrodynamic radius), BET (surface area).\n\nApplications: Au nanoparticles (cancer photothermal therapy, lateral flow assays), Fe₃O₄ (MRI contrast agent, magnetic drug delivery), TiO₂ (photocatalysis, self-cleaning surfaces), carbon black (rubber reinforcement), quantum dots (QLED displays).\n\nToxicology: inhalation of nanomaterials → lung inflammation; reactive oxygen species (ROS) generation; regulatory frameworks still developing; in vitro/in vivo toxicity studies required.',
  },

  thin_film_deposition: {
    summary: 'Thin film deposition creates layers from nanometers to micrometers thick on substrates, enabling semiconductor devices, optical coatings, and protective films through physical or chemical vapor deposition methods.',
    explanation: 'PVD (Physical Vapor Deposition): evaporation (thermal or e-beam) → vapor → deposition on substrate; line-of-sight deposition; poor conformality; used for metal contacts, optical coatings.\n\nSputtering: inert gas (Ar) ions bombard target material; eject atoms that deposit on substrate; better step coverage than evaporation; reactive sputtering (add N₂/O₂ for nitride/oxide films); magnetron sputtering for metals.\n\nCVD (Chemical Vapor Deposition): precursor gases react on heated substrate → solid film; better conformality; LPCVD (low pressure, excellent uniformity), PECVD (plasma-enhanced, lower temperature); SiO₂, Si₃N₄, poly-Si deposition.\n\nALD (Atomic Layer Deposition): self-limiting reactions; alternating precursor pulses; deposits exactly one monolayer per cycle; atomically precise control of thickness; excellent conformality into high-aspect-ratio features; Al₂O₃, HfO₂ (high-k gate dielectric).\n\nALE (Atomic Layer Etching): ALD reverse; self-limiting etch cycles; angstrom-level control; important for sub-7nm node semiconductor manufacturing.\n\nMBE (Molecular Beam Epitaxy): ultra-high vacuum, effusion cells for each element; precise layer-by-layer growth; in-situ RHEED monitoring of surface; highest purity semiconductor heterostructures for research.\n\nFilm characterization: ellipsometry (optical constants and thickness), XRR (X-ray reflectivity, density/thickness), AFM (roughness), XPS (composition, chemical state), four-point probe (sheet resistance).',
  },

// ── INSTRUMENTATION & MEASUREMENT ────────────────────────────

  sensor_calibration: {
    summary: 'Sensor calibration establishes the relationship between sensor output and the actual measured quantity, correcting for offset, gain errors, nonlinearity, and environmental effects to ensure measurement accuracy and traceability.',
    explanation: 'Calibration: compare sensor output to a reference standard traceable to SI units (NIST, PTB); record input-output relationship; generate calibration curve or correction coefficients.\n\nTypes: static calibration (steady-state, DC response), dynamic calibration (frequency response, step response, impulse response).\n\nError sources: offset (zero error, additive), gain error (span error, multiplicative), nonlinearity (polynomial or lookup table correction), hysteresis (different values on up/down sweep), temperature coefficient (drift with temperature).\n\nLeast-squares curve fitting: fit calibration data to polynomial y = a₀ + a₁x + a₂x² using pseudoinverse; evaluate residuals; goodness of fit via R².\n\nUncertainty analysis (GUM): Type A (statistical from repeated measurements), Type B (from specifications, previous calibrations); combined standard uncertainty u_c = √(Σu_i²); expanded uncertainty U = k·u_c (k=2 for 95% confidence).\n\nIn-situ calibration: drift correction in deployed sensors; field-replaceable calibration standards; auto-zero functions (zero calibration at regular intervals); Kalman filter for dynamic sensor fusion.\n\nTraceability: calibration certificate with reference standard, method, environmental conditions, uncertainty; calibration interval based on drift rate; ISO 17025 accredited calibration laboratory.',
  },

  oscilloscope_basics: {
    summary: 'The oscilloscope is the most fundamental electronic measurement instrument, displaying voltage waveforms versus time. Modern digital oscilloscopes (DSO) capture, process, and analyze signals from DC to GHz, with advanced triggering and protocol decoding.',
    explanation: 'Analog oscilloscope: electron beam deflected vertically by signal voltage, horizontally by time base sweep; fast phosphor persistence; real-time display; largely replaced by DSO.\n\nDigital Sampling Oscilloscope (DSO): ADC samples signal (1 GSa/s to 100+ GSa/s); stores in acquisition memory; waveform reconstructed and displayed; bandwidth limited to Nyquist limit (f_BW ≈ 0.35/rise_time).\n\nEquivalent-time sampling (ETS): for repetitive signals faster than ADC rate; interleave samples from multiple trigger events; enables bandwidth beyond ADC speed (TDR, pulse measurements).\n\nTrigger: starts waveform acquisition at consistent point; edge trigger (threshold + slope), pulse width trigger, pattern trigger; trigger modes: auto (free-run if no trigger), normal (waits for trigger), single.\n\nProbes: 1× probe (direct, low bandwidth, no attenuation), 10× probe (high impedance 10MΩ||10pF, 10× attenuation, 10× higher bandwidth); probe compensation (square wave adjustment to match probe to scope input); current probes (current transformer).\n\nMeasurements: period, frequency, rise time, fall time, overshoot, duty cycle, Vpp, Vrms, mean, phase between channels; cursor measurements; automated measurements via scripting (SCPI over GPIB/USB/LAN).\n\nSerial protocol decoding: built-in decoders for UART, SPI, I2C, CAN, USB, PCIe; trigger on specific protocol events; correlate analog waveform with digital decode.',
  },

  lock_in_amplifier: {
    summary: 'The lock-in amplifier measures extremely small AC signals buried in noise by using phase-sensitive detection — multiplying the signal by a reference sinusoid and low-pass filtering — effectively acting as a narrow bandpass filter at the reference frequency.',
    explanation: 'Principle: signal V_s(t) = A_s sin(ω_r t + φ_s) at reference frequency ω_r; multiply by reference V_r(t) = sin(ω_r t); product contains DC term (A_s cos φ_s)/2 + 2ω term; low-pass filter removes 2ω term → DC proportional to signal amplitude.\n\nIn-phase and quadrature channels: multiply by cos(ω_r t) and sin(ω_r t); gives X = A_s cos φ, Y = A_s sin φ; R = √(X²+Y²) (magnitude), θ = atan(Y/X) (phase); independent of reference phase.\n\nTime constant: LPF time constant τ determines noise bandwidth Δf = 1/(4τ) and response time; longer τ → narrower bandwidth → better noise rejection → slower response; roll-off 6/12/18/24 dB/oct.\n\nDynamic reserve: ratio of maximum tolerable interfering signal to minimum detectable signal; high dynamic reserve needed when large noise at off-reference frequencies; comes at cost of accuracy.\n\nApplications: optical absorption spectroscopy (modulate light, detect at modulation frequency), impedance spectroscopy (modulate voltage, detect current), scanning probe microscopy (tip oscillation at reference), SQUID readout, spin resonance.\n\nDigital lock-in: DSP implementation; ADC digitizes at high rate; digital multiplication and FIR filtering; superior dynamic range vs analog; Stanford Research SR830/860, Zurich Instruments MFLI/UHFLI.\n\nSensitivity: can detect signals <1 nV in noisy environment; limited by input noise floor (voltage noise × √Δf); cooled pre-amplifier reduces noise below Johnson noise of room-temperature resistors.',
  },

  data_acquisition_systems: {
    summary: 'Data acquisition (DAQ) systems convert physical signals to digital data for computer processing. They integrate sensors, signal conditioning, ADC, and software to enable measurement, monitoring, and control in test and industrial applications.',
    explanation: 'DAQ chain: physical phenomenon → sensor → signal conditioning (amplification, filtering, isolation) → ADC → digital processing → storage/display.\n\nKey ADC specifications: resolution (bits: 8-24bit), sampling rate (1 Sa/s to 1 GSa/s), input range (±1V to ±10V), SNR, ENOB (effective bits = (SNR_dB - 1.76)/6.02), input impedance.\n\nSampling theory: must sample at ≥ 2× signal bandwidth (Nyquist-Shannon); anti-aliasing low-pass filter before ADC limits signal to Nyquist frequency; higher sample rate = more comfortable margin.\n\nSignal conditioning: instrumentation amplifier (high CMRR for differential signals like thermocouple, strain gauge), isolation amplifier (breaks ground loops, safety), CJC (cold junction compensation for thermocouple), bridge completion for resistive sensors (Wheatstone bridge → differential voltage).\n\nDAQ hardware: NI (National Instruments) DAQmx API; USB, PCI, PXI form factors; chassis with modular cards (NI cDAQ-9174 + NI-9234 for vibration, NI-9213 for thermocouple); Raspberry Pi + MCP3208 for budget.\n\nLabVIEW / Python: LabVIEW graphical programming; NI DAQmx Python (nidaqmx library); Measurement Studio (.NET); InfluxDB + Grafana for time-series storage and dashboards.\n\nSynchronization: multiple channels triggered from same sample clock → channel-to-channel skew < 1 clock period; GPS-disciplined clock for absolute time; IEEE 1588 PTP for distributed sync across network DAQs.',
  },

  precision_measurement: {
    summary: 'Precision measurement achieves sub-micrometer to sub-nanometer accuracy through careful instrument design, environmental control, error budgeting, and metrological principles including traceability, repeatability, and uncertainty quantification.',
    explanation: 'Metrological triangle: accuracy (closeness to true value), precision/repeatability (consistency), resolution (smallest detectable change); precision without accuracy → systematic error; accurate but imprecise → random errors dominate.\n\nAbbe principle (comparator principle): align measurement axis with object axis to eliminate cosine/Abbe errors; violation in non-collinear measurement causes angular error amplified by offset distance.\n\nEnvironmental effects: temperature coefficient of expansion (CTE); thermal expansion Δl = α·l·ΔT; Invar (α=1.2×10⁻⁶/K) for low expansion; 20°C reference temperature for dimensional metrology (ISO 1); vibration isolation (air table, granite surface plate).\n\nCoordinate Measuring Machine (CMM): touch probe or scanning probe; 3D measurement of workpiece geometry; Renishaw probe; measurement uncertainty typically 2-10μm; compensated for thermal and geometric machine errors.\n\nLaser interferometry: He-Ne laser (633nm) fringe counting; λ/2 per fringe = 316nm resolution; sub-nm with homodyne/heterodyne detection; Abbe error from off-axis measurement; used for machine tool calibration, semiconductor fab.\n\nAFM (Atomic Force Microscope): cantilever tip samples surface forces; z-motion < 0.1nm; contact, tapping, non-contact modes; can image single atoms; used for roughness, nanostructure characterization.\n\nGauge R&R (Repeatability and Reproducibility): evaluate measurement system variation vs part variation; ANOVA or range method; gauge is acceptable if P/T ratio < 10-30%; critical in manufacturing process control.',
  },

  noise_reduction_techniques: {
    summary: 'Electronic noise reduction in measurement systems employs shielding, grounding, filtering, differential signaling, and signal averaging to achieve the minimum detectable signal limited only by fundamental thermal (Johnson) and quantum noise.',
    explanation: 'Thermal (Johnson) noise: fundamental noise in any resistor at temperature T; V_n = √(4k_BTRΔf); irreducible unless cooled; V_n density = √(4k_BTR) ≈ 4nV/√Hz at room temperature for 1kΩ.\n\nShot noise: fluctuation in discrete charge carriers; I_n = √(2qIΔf); dominates in low-current photodetectors, semiconductor junctions; fundamental quantum noise.\n\n1/f (flicker) noise: power spectral density ∝ 1/f; dominates at low frequencies; JFET < MOSFET for low-frequency noise; modulate signal above 1/f corner frequency (lock-in technique).\n\nShielding: Faraday cage prevents electrostatic coupling (E-field); mu-metal shield for static magnetic fields; RF shielding (copper/aluminum enclosure) for EM interference; shield current return path matters.\n\nGrounding: star grounding topology (single point prevents ground loop currents); differential measurement rejects common-mode noise (CMRR of instrumentation amp); floating measurement for high-impedance sources.\n\nFiltering: RC low-pass (simple), active filters (Butterworth, Chebyshev, Bessel for phase response), switched-capacitor filters; avoid filtering signal content needed for measurement; place filter after amplification.\n\nAveraging: random noise reduces as 1/√N with N averages; SNR improves 10dB per 10× more averages; requires signal coherence (triggered synchronous averaging) or averaging power spectrum (incoherent averages).',
  },

// ── CLASSICAL MECHANICS (continued) ──────────────────────────

  oscillations_damping: {
    summary: 'Oscillatory systems exhibit resonance, damping, and coupled mode behavior. The driven harmonic oscillator model underpins mechanical vibration analysis, electrical RLC circuits, atomic physics, and signal processing.',
    explanation: 'Simple harmonic oscillator: ẍ + ω₀²x = 0; ω₀ = √(k/m); solution x = A cos(ω₀t + φ); SHO conserves total energy (potential ↔ kinetic).\n\nDamped oscillator: ẍ + 2γẋ + ω₀²x = 0; underdamped (γ < ω₀): oscillation with decaying amplitude e^(-γt); critically damped (γ = ω₀): fastest non-oscillatory return; overdamped (γ > ω₀): slow exponential return.\n\nQ factor: Q = ω₀/2γ = resonant frequency / bandwidth; high Q → narrow resonance, slow decay; low Q → broad resonance, fast damping; pendulum Q~100, quartz resonator Q~10⁵, optical cavity Q~10⁸.\n\nDriven harmonic oscillator: ẍ + 2γẋ + ω₀²x = F₀/m × cos(ωt); steady-state amplitude A(ω) = (F₀/m)/√((ω₀²-ω²)² + 4γ²ω²); resonance at ω_r = √(ω₀²-2γ²).\n\nCoupled oscillators: N coupled masses → N normal modes; each mode oscillates at its eigenfrequency; energy exchange between modes at beat frequency; basis of phonon theory in solids.\n\nNonlinear oscillations: Duffing oscillator (cubic nonlinearity); jump phenomenon (hysteresis in resonance curve); van der Pol oscillator (self-sustained oscillation via negative damping); period doubling route to chaos.',
  },

  thermodynamics_classical: {
    summary: 'Classical thermodynamics defines the macroscopic laws governing energy, heat, work, and entropy in physical systems. The four laws establish absolute temperature, energy conservation, entropy increase, and the unattainability of absolute zero.',
    explanation: 'Zeroth law: thermodynamic equilibrium is transitive; defines temperature; if A in equilibrium with C and B in equilibrium with C, then A in equilibrium with B.\n\nFirst law: ΔU = Q - W (change in internal energy = heat added - work done by system); energy conservation including heat; U is a state function, Q and W are path-dependent.\n\nSecond law: entropy of isolated system never decreases (dS ≥ 0); heat flows spontaneously from hot to cold; Carnot efficiency η = 1 - T_cold/T_hot (maximum possible efficiency for heat engine).\n\nThird law (Nernst): entropy approaches a constant (taken as zero) as T → 0; absolute zero unattainable in finite steps; residual entropy in disordered solids (glass, alloys).\n\nThermodynamic potentials: U (internal energy, constant S,V), H = U+PV (enthalpy, constant S,P), F = U-TS (Helmholtz, constant T,V), G = H-TS (Gibbs, constant T,P); Maxwell relations from exact differentials.\n\nGibbs free energy: ΔG = ΔH - TΔS; ΔG < 0 → spontaneous at constant T,P; ΔG = 0 at equilibrium; chemical potential μ_i = (∂G/∂N_i)_{T,P,N_{j≠i}}; phase equilibrium: μ equal in all phases.',
  },

  relativity_special: {
    summary: 'Special relativity, from the postulates that physics is the same in all inertial frames and the speed of light is constant, yields time dilation, length contraction, mass-energy equivalence (E=mc²), and the Lorentz transformation.',
    explanation: 'Postulates: (1) laws of physics identical in all inertial frames; (2) speed of light c constant in all inertial frames regardless of source/observer motion.\n\nLorentz factor: γ = 1/√(1-v²/c²); γ → ∞ as v → c; determines magnitude of relativistic effects.\n\nTime dilation: Δt = γΔt₀; moving clocks run slow; GPS satellites must correct for ~7μs/day time dilation (+ GR correction); muon lifetime extended from 2.2μs to detectable at sea level.\n\nLength contraction: L = L₀/γ; objects moving at velocity v are shortened in direction of motion by factor γ; perpendicular dimensions unchanged.\n\nMass-energy equivalence: E = γmc²; rest energy E₀ = mc²; kinetic energy K = (γ-1)mc²; total energy E² = (pc)² + (mc²)² → massless particles: E = pc.\n\nLorentz transformation: t\' = γ(t - vx/c²), x\' = γ(x-vt); 4-vector spacetime interval ds² = c²dt² - dx² - dy² - dz² is Lorentz invariant.\n\nRelativity of simultaneity: events simultaneous in one frame may not be in another; causality preserved (cause always precedes effect in all frames) if v < c for signals.',
  },

  rigid_body_dynamics: {
    summary: 'Rigid body dynamics extends particle mechanics to extended objects with distributed mass, introducing rotational inertia, angular momentum, torque, and the inertia tensor for 3D rotational motion.',
    explanation: 'Moment of inertia: I = Σm_i r_i² (discrete) or ∫r²ρdV (continuous); depends on axis; I_sphere = (2/5)mr², I_cylinder = (1/2)mr², I_rod = (1/12)mL².\n\nParallel axis theorem: I = I_cm + Md²; moment of inertia about any axis = I about parallel axis through CM + Md².\n\nInertia tensor: I_ij = Σm_k(r_k² δ_ij - r_ki r_kj); 3×3 symmetric tensor; principal axes diagonalize it; principal moments I₁, I₂, I₃.\n\nEuler\'s equations: I₁ω̇₁ + (I₃-I₂)ω₂ω₃ = τ₁ (and cyclic); describe rotation in body frame; torque-free symmetric top → precession at Ω_p = (I₃-I₁)ω₃/I₁.\n\nGyroscope: spinning top; angular momentum L = Iω; torque τ = r×mg; gyroscopic precession: Ω_prec = mgr/Lω; gyroscopic stability; basis of gyroscope sensors (MEMS, fiber optic, ring laser).\n\nRolling motion: rolling without slipping v_cm = ωR; kinetic energy K = ½mv²_cm + ½Iω² = ½(1+I/mR²)mv²; faster rolling for lower I/mR².',
  },

  plasma_physics_basics: {
    summary: 'Plasma is the fourth state of matter — an ionized gas with free electrons and ions exhibiting collective electromagnetic behavior. It comprises 99% of visible matter in the universe and is central to fusion energy, plasma processing, and space physics.',
    explanation: 'Debye length: λ_D = √(ε₀k_BT/ne²); screening length; electric potential of a charge shielded exponentially beyond λ_D; plasma quasi-neutral on scales >> λ_D.\n\nPlasma frequency: ω_p = √(ne²/mε₀); oscillation frequency of electron density perturbations; EM waves cannot propagate at ω < ω_p (plasma cut-off frequency); basis of ionospheric radio reflection.\n\nMagnetic confinement: Lorentz force F = qv×B causes circular motion; gyroradius r_L = mv⊥/qB; magnetic mirror traps charged particles; tokamak uses toroidal magnetic field for fusion plasma confinement.\n\nMHD (Magnetohydrodynamics): plasma as conducting fluid; combines fluid + Maxwell; Alfvén waves propagate along B field; frozen-in flux theorem (ideal MHD); solar wind, magnetosphere dynamics.\n\nDrift waves: in density gradient + magnetic field; E×B drift (perpendicular to both E and B, independent of charge); grad-B drift; causes anomalous transport in tokamaks.\n\nInertial confinement fusion (ICF): laser or X-ray drives rapid compression of D-T fuel pellet; National Ignition Facility (NIF) achieved ignition in 2022 (fusion energy > laser energy delivered).',
  },

// ── ELECTROMAGNETISM (continued) ─────────────────────────────

  waveguides_microwave: {
    summary: 'Waveguides confine electromagnetic waves to propagate in hollow metal tubes or dielectric structures, supporting discrete propagation modes used in microwave systems, radar, and millimeter-wave communications.',
    explanation: 'Rectangular waveguide: TE (transverse electric) and TM (transverse magnetic) modes; TE_mn: cut-off frequency f_c = c/(2π)√((mπ/a)²+(nπ/b)²); dominant mode TE₁₀; propagation only above cut-off.\n\nPhase velocity in waveguide: v_p = c/√(1-(f_c/f)²) > c; group velocity v_g = c√(1-(f_c/f)²) < c; v_p × v_g = c²; energy propagates at v_g.\n\nMicrostrip: planar transmission line; conductor strip on dielectric substrate with ground plane; field partly in substrate, partly in air → effective permittivity ε_eff; compact, PCB-compatible; used in RF circuits.\n\nS-parameters: scattering matrix for N-port network; S_11 (reflection), S_21 (transmission); measured with VNA (Vector Network Analyzer); convert to Z, Y, ABCD matrices; time-domain reflectometry (TDR).\n\nMicrowave resonators: rectangular/cylindrical cavity; Q = ω₀ × stored energy / power lost; unloaded Q up to 10⁵ for superconducting resonators; used in filters, oscillators, accelerators.\n\nCoaxial line: TEM mode (no cut-off, works DC to GHz); characteristic impedance Z₀ = 60/√ε_r × ln(b/a); standard 50Ω (RF power), 75Ω (video/cable TV); SMA connector to 18GHz, 2.4mm to 50GHz.',
  },

  superconductivity: {
    summary: 'Superconductivity is the complete loss of electrical resistance and expulsion of magnetic flux (Meissner effect) below a critical temperature T_c. It enables lossless current, high-field magnets (MRI, LHC), and quantum computing qubits.',
    explanation: 'Meissner effect: below T_c, superconductor expels all magnetic flux (B=0 inside); Type I: sharp transition, complete Meissner below B_c; Type II: two critical fields B_c1 (flux entry) and B_c2 (normal state); partial flux penetration as quantized vortices between B_c1 and B_c2.\n\nBCS theory (1957): electron-phonon interaction causes Cooper pair formation (two electrons with opposite spin/momentum); pair condensate described by macroscopic wave function Ψ; superconductivity = superfluid of Cooper pairs.\n\nEnergy gap: 2Δ above ground state; thermal excitations suppressed at T << T_c; Δ(0) ≈ 1.76 k_B T_c; gap measured by microwave absorption, tunneling.\n\nJosephson effect: supercurrent tunnels through thin insulator junction (SIS); DC Josephson: I = I_c sin(φ), where φ = phase difference; AC Josephson: V = (ℏ/2e) dφ/dt = hf/2e (2e/h = 483.6 GHz/mV); SQUID uses two Josephson junctions → ultrasensitive magnetometer.\n\nHigh-temperature superconductors (HTS): YBCO (T_c = 93K, liquid nitrogen cooling), BSCCO, MgB₂ (T_c = 39K); cuprate mechanism poorly understood; room-temperature superconductivity active research area.\n\nApplications: MRI magnets (NbTi at 4K), LHC dipole magnets (NbTi, 8.3T), ITER fusion reactor (Nb₃Sn), quantum computing (Al, Nb transmon qubits at 10-20 mK), power cables (HTS for urban grids).',
  },

  electromagnetic_compatibility: {
    summary: 'Electromagnetic Compatibility (EMC) ensures electronic devices operate without causing or suffering from unintended electromagnetic interference. Design for EMC involves shielding, filtering, PCB layout, and regulatory compliance testing.',
    explanation: 'EMI sources: switching power supplies (SMPS: high dI/dt edges), clock signals (harmonics to GHz), ESD (electrostatic discharge), motors, RF transmitters; conducted (via power lines) and radiated (through air).\n\nConducted emissions: high-frequency current on power lines; measured with LISN (Line Impedance Stabilization Network); EN 55032 limits; common-mode (both lines in same direction) and differential-mode (loop current) noise.\n\nRadiated emissions: far-field electric field measured at 3m or 10m; CISPR 32, FCC Part 15 limits; antenna loops from PCB traces + cables; minimize loop area → reduce dI/dt via snubbers.\n\nShielding effectiveness: SE (dB) = 20 log(E_without / E_with); absorption loss (material thickness/skin depth) + reflection loss; copper/aluminum for E-field; mu-metal for H-field at low frequency; apertures (connectors, seams) dominate SE at high frequency.\n\nPCB layout for EMC: separate analog, digital, power planes; return current flows directly under signal trace (minimizes loop area); decouple every IC with 100nF close to power pin; differential pairs for clocks and high-speed signals; ground stitch vias at plane transitions.\n\nESD protection: human body model (100pF, 1.5kΩ, ~2kV); TVS diode at every external pin; ESD guard rings in CMOS; IEC 61000-4-2 test: ±8kV contact, ±15kV air discharge.\n\nRegulatory testing: CE marking (ETSI EN 55032, EN 61000), FCC Part 15 (US), VCCI (Japan); pre-compliance testing in-house to reduce costly test lab iterations.',
  },

  photonics_basics: {
    summary: 'Photonics studies the generation, manipulation, and detection of photons for communications, sensing, and computing. Key components — lasers, waveguides, modulators, and detectors — form the basis of fiber optic networks and integrated photonic circuits.',
    explanation: 'Laser operation: population inversion (more atoms in excited than ground state); stimulated emission (Einstein B coefficient); optical cavity feedback (Fabry-Perot, DFB grating); gain > loss → lasing threshold.\n\nLaser types: semiconductor diode laser (direct-gap: GaAs, InP; edge-emitting or VCSEL), fiber laser (Er³⁺ doped, 1550nm, narrow linewidth), Ti:Sapphire (tunable 700-1000nm, femtosecond pulses), CO₂ (10.6μm, material cutting).\n\nOptical modulation: EO modulator (Mach-Zehnder interferometer with phase shift via Pockels effect in LiNbO₃ or silicon); electro-absorption modulator (bandgap shift via quantum-confined Stark effect); 400Gbit/s DP-16QAM coherent modulation.\n\nPhotodetectors: PIN diode (depletion region absorbs photon → electron-hole pair, bandwidth 1-40GHz); APD (avalanche photodiode: internal gain via impact ionization, more sensitive but noisier); SNSPD (superconducting nanowire, single photon detection, efficiency >90%).\n\nSilicon photonics: waveguides in Si/SiO₂ platform; CMOS-compatible fab; integrated ring resonators (WDM), Mach-Zehnder modulators (silicon PN junction), Ge photodetectors; Intel, Cisco, Luxtera commercial products.\n\nOptical amplifiers: EDFA (Er-doped fiber, 1530-1565nm, 30dB gain, multi-channel) and SOA (semiconductor, broadband); coherent transmission: 400G ZR, 800G; OSNR budget limits reach.',
  },

  magnetic_resonance_physics: {
    summary: 'Magnetic resonance exploits the quantum mechanical spin of nuclei (NMR) or electrons (EPR) in magnetic fields for chemical structure determination, medical imaging (MRI), and quantum information processing.',
    explanation: 'Nuclear spin: nuclei with odd nucleon number have net spin I; ¹H (I=1/2), ¹³C (I=1/2), ³¹P (I=1/2); spin states (mI = ±1/2 for I=1/2) split in B₀ field (Zeeman splitting ΔE = γℏB₀).\n\nLarmor precession: nuclear magnetic moment precesses around B₀ at ω₀ = γB₀; γ (gyromagnetic ratio) = 2.675×10⁸ rad/s/T for ¹H; at 7T B₀: ¹H Larmor freq = 300 MHz.\n\nRF pulse: 90° pulse tips magnetization to transverse plane; precessing transverse magnetization induces voltage in receiver coil (FID, free induction decay); Fourier transform → NMR spectrum.\n\nChemical shift: local electron density shields nucleus from B₀; resonance frequency shifts by δ = (ν - ν_ref)/ν_ref × 10⁶ ppm; TMS reference (0 ppm); different chemical environments → distinct peaks; structure identification.\n\nRelaxation: T₁ (longitudinal/spin-lattice, energy to lattice, ms-s), T₂ (transverse/spin-spin, phase coherence loss, ms-s); T₂* (includes field inhomogeneity); MRI contrast based on T₁/T₂ differences in tissues.\n\nEPR/ESR (Electron Paramagnetic Resonance): analogous to NMR for unpaired electrons; g-factor analogous to chemical shift; detects radicals, transition metal complexes, defects in materials; much higher sensitivity per spin than NMR.',
  },

// ── CHEMISTRY (continued) ─────────────────────────────────────

  catalysis_chemistry: {
    summary: 'Catalysis accelerates chemical reactions by providing alternative lower-energy pathways without being consumed. Heterogeneous, homogeneous, and enzyme catalysis underpin chemical manufacturing, fuel cells, and drug synthesis.',
    explanation: 'Heterogeneous catalysis: catalyst in different phase from reactants (solid catalyst + gas/liquid reactants); Langmuir-Hinshelwood mechanism (both adsorb → react on surface); industrial examples: Haber-Bosch (Fe catalyst, NH₃ synthesis), Fischer-Tropsch (Co/Fe, syngas → hydrocarbons), automotive catalytic converter (Pt/Pd/Rh, CO/HC/NOx).\n\nAdsorption: physisorption (van der Waals, reversible, low ΔH), chemisorption (covalent/ionic bond, high ΔH, forms surface species); BET analysis measures surface area; TPD (temperature-programmed desorption) reveals binding strength.\n\nHomogeneous catalysis: catalyst dissolved with reactants; Wilkinson\'s catalyst (RhCl(PPh₃)₃) for hydrogenation; organocatalysis (proline for asymmetric aldol); high selectivity and activity but difficult separation.\n\nAsymmetric catalysis (Nobel 2001): chiral catalysts produce enantiomerically enriched products; Noyori (Ru-BINAP for asymmetric hydrogenation), Sharpless (asymmetric epoxidation); ee (enantiomeric excess) = (R-S)/(R+S) × 100%.\n\nPhotocatalysis: light excites catalyst (TiO₂ band gap 3.2eV, UV); generates electron-hole pairs; oxidize organic pollutants, split water (H₂ evolution, O₂ evolution half-reactions); Z-scheme for visible light water splitting.\n\nNanocatalysis: size-dependent catalytic activity (gold nanoparticles catalyze CO oxidation at room temperature, bulk gold inert); shape effects (corners, edges more active); single-atom catalysis (SAC) maximizes atom efficiency.',
  },

  surface_chemistry: {
    summary: 'Surface chemistry studies chemical phenomena at interfaces — adsorption, catalysis, corrosion, thin film growth — where the discontinuity of the bulk structure creates unique reactivity. Surface techniques operate under ultra-high vacuum for atomic-level characterization.',
    explanation: 'Surface energy: atoms at surface have fewer neighbors → unsatisfied bonds → higher energy; surface tension in liquids; reconstruction (surface atoms rearrange to minimize energy); Si(100) 2×1 reconstruction, graphene moiré on metals.\n\nLangmuir isotherm: monolayer adsorption at equivalent sites with no interactions; θ = KP/(1+KP); θ = fractional coverage, K = adsorption equilibrium constant, P = pressure; saturation at high P.\n\nXPS (X-ray Photoelectron Spectroscopy): core electron binding energies element and oxidation state specific; chemical shift: higher oxidation state → higher binding energy; quantitative elemental analysis; surface sensitive (2-10nm).\n\nAuger electron spectroscopy (AES): core hole → Auger electron emission; element-specific kinetic energy; maps surface composition at nm resolution with scanning electron beam (SAM).\n\nSTM (Scanning Tunneling Microscope): quantum tunneling current between tip and conducting surface; atomic resolution imaging; measure local density of states (spectroscopy mode); STS reveals band gap, surface states.\n\nWork function: energy to remove electron from Fermi level to vacuum; Kelvin probe force microscopy (KPFM) maps work function variation; contact potential difference drives electron transfer at metal/semiconductor interfaces.\n\nSelf-assembled monolayers (SAMs): thiols on gold (S-Au bond); ordered monolayer via van der Waals packing; functional tail group controls surface properties (hydrophobic, hydrophilic, reactive); basis of biosensor functionalization.',
  },

  physical_chemistry_thermo: {
    summary: 'Physical chemistry applies physics to chemical systems — chemical thermodynamics, kinetics, and quantum chemistry — providing quantitative predictions of reaction spontaneity, equilibrium, and rate from molecular properties.',
    explanation: 'Chemical potential: μ = μ° + RT ln a; activity a = γ·c/c° (corrects for non-ideality); chemical potential gradient drives mass transport; equilibrium: μ_i equal in all phases.\n\nPhase rule: F = C - P + 2 (Gibbs phase rule); F = degrees of freedom, C = components, P = phases; triple point of water: F = 1 - 3 + 2 = 0 (fixed point).\n\nElectrochemical thermodynamics: ΔG = -nFE (coupling between electrical and chemical driving forces); reversible work = electrical work; concentration cells; Nernst equation from ΔG = ΔG° + RT ln Q.\n\nColligative properties: boiling point elevation ΔT_b = K_b m; freezing point depression ΔT_f = K_f m; osmotic pressure π = MRT; depend only on mole fraction of solute, not identity.\n\nActivity coefficients: Debye-Hückel limiting law: log γ± = -A|z+z-|√I for electrolyte solutions; I = ionic strength = ½Σcᵢzᵢ²; corrections essential for concentrated solutions.\n\nMolecular partition function: q = Σ_i g_i exp(-E_i/k_BT); thermodynamic quantities from ln q; translation (monatomic ideal gas q_trans = V/λ_th³), rotation, vibration, electronic contributions to q_total.\n\nSolvation: Born solvation model (continuum dielectric); free energy of solvation ΔG_solv = -(z²e²/8πε₀r)(1-1/ε_r); PCM (Polarizable Continuum Model) in QC calculations; explicit solvent MD for accurate solvation.',
  },

  nuclear_chemistry: {
    summary: 'Nuclear chemistry studies radioactive decay, nuclear reactions, and the applications of radioactivity in dating, medicine, and energy. Understanding decay modes, half-lives, and radiation interactions is essential for nuclear medicine and reactor operation.',
    explanation: 'Radioactive decay: α (helium nucleus, 4 amu, +2 charge, stopped by paper), β⁻ (electron emission, neutron→proton, penetrates ~1cm Al), β⁺ (positron, proton→neutron, annihilates with electron → 2×511 keV γ), γ (photon, penetrates meters of concrete), electron capture.\n\nDecay law: N(t) = N₀ exp(-λt); λ = decay constant; half-life t₁/₂ = ln2/λ; activity A = λN; Curie (Ci) = 3.7×10¹⁰ decays/s, Becquerel (Bq) = 1 decay/s.\n\nRadiometric dating: ¹⁴C dating (t₁/₂=5730yr, up to 50,000yr ago), U-Pb dating (t₁/₂=4.5×10⁹yr for ²³⁸U, geological timescales), K-Ar, Rb-Sr for igneous rocks.\n\nNuclear reactions: fission (heavy nucleus splits, releases ~200 MeV: ²³⁵U + n → ⁹²Kr + ¹⁴¹Ba + 3n + γ); fusion (light nuclei combine, releases ~17.6 MeV: D + T → ⁴He + n); binding energy per nucleon maximum at Fe-56.\n\nNuclear medicine: PET: F-18 FDG (t₁/₂=110min), Tc-99m SPECT (t₁/₂=6h, 140keV γ, most widely used); therapy: I-131 thyroid cancer, Y-90 microspheres liver cancer, PSMA-617 prostate.\n\nReactor physics: moderation (slow neutrons to thermal energy with H₂O, D₂O, graphite); criticality (k_eff=1); control rods absorb neutrons (B, Cd, In); Doppler broadening provides negative temperature feedback for stability.',
  },

  mass_spectrometry_chem: {
    summary: 'Mass spectrometry separates ions by mass-to-charge ratio to determine molecular weight, molecular formula, and structural fragments. Hyphenated techniques (GC-MS, LC-MS) enable trace analysis in environmental, pharmaceutical, and metabolomics applications.',
    explanation: 'Ionization methods: EI (electron ionization, 70eV electron beam, M⁺• radical cation, extensive fragmentation, good for GC-MS volatile organics), ESI (electrospray, multiply charged, soft, large biomolecules, LC-MS), MALDI (matrix-assisted laser desorption, large polymers/proteins, MALDI-TOF).\n\nMass analyzers: quadrupole (scan by RF/DC voltage, unit resolution, fast, inexpensive), TOF (time-of-flight, m/z ∝ t², high resolution, high mass), FTICR (ion cyclotron resonance, highest resolution >10⁶, Fourier transform), Orbitrap (electrostatic trapping, >100,000 resolution).\n\nTandem MS (MS/MS): select precursor ion, fragment in collision cell (CID, HCD), analyze product ions; structure elucidation; peptide sequencing (b and y ions); MRM (multiple reaction monitoring) for quantitation.\n\nProteomics workflow: protein digestion (trypsin cleaves at K/R), LC separation, ESI-MS/MS, database search (Mascot, Sequest) for peptide identification; label-free or TMT-labeled quantitation.\n\nMetabolomics: untargeted metabolomics profiles all small molecules; high-resolution MS (HRMS) gives molecular formula from exact mass; MS/MS for structural elucidation; HMDB, METLIN spectral libraries.\n\nIsotope dilution: spike with isotopically labeled standard (D, ¹³C, ¹⁵N); mix with sample; ratio of labeled/unlabeled gives absolute concentration; most accurate quantitative method (eliminates matrix effects).',
  },

// ── BIOLOGY (continued) ───────────────────────────────────────

  cell_biology_basics: {
    summary: 'Cell biology describes the structure and function of cells — the fundamental units of life. Organelles compartmentalize cellular processes; the cytoskeleton provides structural support; membrane transport controls the cellular environment.',
    explanation: 'Cell organelles: nucleus (genome + transcription), mitochondria (ATP via oxidative phosphorylation + TCA cycle), ER (rough: protein synthesis, smooth: lipid synthesis, detox), Golgi (glycosylation, sorting, secretion), lysosomes (hydrolytic enzymes, pH 4.5), peroxisomes (fatty acid β-oxidation, ROS detox).\n\nPlasma membrane: phospholipid bilayer (amphipathic, fluid mosaic model); membrane proteins (integral: transmembrane, peripheral: surface-associated); cholesterol modulates fluidity.\n\nMembrane transport: passive diffusion (small nonpolar molecules), facilitated diffusion (channels: aquaporins, ion channels; carriers: GLUT), active transport (Na⁺/K⁺-ATPase pumps 3Na⁺ out/2K⁺ in at cost of ATP).\n\nCytoskeleton: actin filaments (7nm, cell motility, lamellipodia), intermediate filaments (10nm, structural support, vimentin/keratin), microtubules (25nm, cell division spindle, intracellular transport, tubulin polymerization).\n\nCell cycle: G1 (growth, checkpoint), S (DNA synthesis), G2 (preparation, checkpoint), M (mitosis: prophase, metaphase, anaphase, telophase, cytokinesis); CDK-cyclin complexes regulate transitions; p53, Rb tumor suppressors.\n\nCell signaling: receptor tyrosine kinase (EGFR: ligand→dimerization→auto-phosphorylation→RAS/MAPK cascade), GPCR (G protein→cAMP→PKA), nuclear receptor (steroid→nucleus→gene transcription); second messengers: cAMP, Ca²⁺, IP₃, DAG.',
  },

  immunology_basics: {
    summary: 'Immunology studies the immune system\'s defense against pathogens through innate (fast, nonspecific) and adaptive (slow, specific, memory) responses. Understanding immunity is essential for vaccine design, cancer immunotherapy, and autoimmune diseases.',
    explanation: 'Innate immunity: first responders; pattern recognition receptors (PRRs) recognize PAMPs (pathogen-associated molecular patterns); Toll-like receptors (TLRs) → NF-κB → cytokine production → inflammation; complement system (opsonization, MAC pore formation); NK cells kill stressed/infected cells.\n\nAdaptive immunity: lymphocytes with antigen-specific receptors; B cells (antibody production, humoral immunity), T cells (cell-mediated immunity).\n\nMHC molecules: MHC I (present intracellular peptides to CD8+ cytotoxic T cells), MHC II (present extracellular peptides to CD4+ helper T cells); polymorphic; HLA in humans.\n\nT cell activation: TCR recognizes peptide-MHC; co-stimulation CD28-B7 required for full activation; Th1 cells (IFN-γ, macrophage activation), Th2 (IL-4/13, antibody, allergies), Treg (immune suppression), Th17 (IL-17, mucosal defense).\n\nAntibodies (immunoglobulins): Y-shaped; Fab region (variable, antigen binding), Fc region (constant, effector functions); IgG (4 subclasses, most abundant), IgM (pentamer, first response), IgA (mucosal secretions), IgE (allergy, parasites).\n\nVaccines: live attenuated, inactivated whole pathogen, subunit (protein), mRNA (Moderna/Pfizer COVID), viral vector (AstraZeneca); adjuvants boost immunogenicity; immune memory (long-lived plasma cells + memory B/T cells).',
  },

  pharmacokinetics: {
    summary: 'Pharmacokinetics (PK) describes how the body processes drugs through absorption, distribution, metabolism, and excretion (ADME). PK modeling predicts drug concentrations over time to optimize dosing regimens.',
    explanation: 'ADME: Absorption (bioavailability F = fraction reaching systemic circulation; oral: first-pass metabolism reduces F), Distribution (Vd = volume of distribution, extent to which drug partitions from blood to tissues), Metabolism (liver CYP450 enzymes: CYP3A4 metabolizes ~50% of drugs), Excretion (renal clearance, biliary secretion).\n\nOne-compartment model: C(t) = C₀ exp(-k_el × t); k_el = elimination rate constant = CL/Vd; half-life t₁/₂ = 0.693/k_el; at steady state: C_ss,avg = F × Dose/(CL × τ).\n\nTwo-compartment model: central (blood) + peripheral (tissues); biexponential decay: C(t) = Ae^(-αt) + Be^(-βt); α (distribution phase) >> β (elimination phase).\n\nClearance (CL): volume of blood cleared of drug per time; hepatic CL = Q_h × ER (extraction ratio); renal CL = GFR × fu × (1 + secretion - reabsorption); total CL = hepatic + renal + other.\n\nDrug-drug interactions: CYP450 inhibition (e.g., ketoconazole inhibits CYP3A4 → elevated substrate levels), induction (rifampin induces CYP3A4 → reduced levels); protein binding displacement; P-glycoprotein efflux.\n\nPK/PD modeling: link PK (concentration-time) with PD (effect-time); Emax model: E = Emax × C/(EC50 + C); Hill equation with cooperativity; target-mediated drug disposition (TMDD) for biologics; population PK for individualized dosing.',
  },

  epigenetics: {
    summary: 'Epigenetics studies heritable changes in gene expression that do not alter DNA sequence — DNA methylation, histone modifications, and non-coding RNAs regulate chromatin structure and gene accessibility across development, disease, and environment.',
    explanation: 'DNA methylation: cytosine methylation at CpG dinucleotides (5-methylcytosine, 5mC) by DNMT1/3a/3b; CpG islands (GC-rich promoter regions) normally unmethylated; methylation → gene silencing; cancer: hypermethylation silences tumor suppressors, global hypomethylation activates oncogenes.\n\nHistone modifications: post-translational modifications on histone tails; H3K4me3 (active promoters), H3K27me3 (Polycomb silencing), H3K27ac (active enhancers), H3K9me3 (heterochromatin); "histone code" hypothesis.\n\nChromatin remodeling: SWI/SNF, NuRD complexes slide/evict nucleosomes; open chromatin (euchromatin) → active transcription; condensed (heterochromatin) → silent.\n\nDNA methylation readers: MBD proteins (MeCP2 — mutations cause Rett syndrome); DNMT3L cofactor for de novo methylation; TET enzymes oxidize 5mC → 5hmC → demethylation pathway.\n\nImprinting: parent-of-origin-specific methylation; some genes expressed only from maternal/paternal allele; Prader-Willi/Angelman syndromes (chromosome 15 imprinted region); required for normal mammalian development.\n\nnon-coding RNAs: lncRNA (>200nt, Xist for X-inactivation, HOTAIR for chromatin regulation), miRNA (22nt, mRNA degradation/translation repression, ~2000 in human genome), piRNA (Piwi-interacting, transposon silencing in germline).\n\nEpigenomics: ATAC-seq (chromatin accessibility), ChIP-seq (histone marks, TF binding), WGBS/RRBS (DNA methylation); single-cell epigenomics; clock epigenetics (Horvath clock predicts biological age from methylation).',
  },

  biosensors: {
    summary: 'Biosensors combine a biological recognition element (antibody, aptamer, enzyme, DNA) with a physicochemical transducer to detect analytes with high specificity. They enable point-of-care diagnostics, environmental monitoring, and drug discovery.',
    explanation: 'Components: bioreceptor (antibody/aptamer/enzyme/cell) + transducer (electrochemical/optical/mechanical) + signal processing; selectivity from bioreceptor, sensitivity from transducer.\n\nElectrochemical biosensors: amperometric (current from redox reaction, e.g., glucose oxidase → H₂O₂ → current at Pt electrode; continuous glucose monitor), potentiometric (ion-selective electrodes, pH electrode, pKa of analyte), impedimetric (binding changes interface impedance).\n\nOptical biosensors: SPR (Surface Plasmon Resonance; gold film, evanescent wave; binding event changes resonance angle; Biacore platform for KD measurement), fluorescence immunoassay, ELISA (enzyme-linked, colorimetric or fluorescent readout).\n\nLateral flow assay (LFA): paper-based point-of-care; sample wicks through nitrocellulose membrane; antibody-labeled Au nanoparticles bind analyte; captured at test line (second antibody); COVID-19 rapid antigen test.\n\nAptamers: short DNA/RNA oligomers selected by SELEX for high-affinity binding; comparable to antibodies; thermally stable, chemical synthesis, modifiable; structure-switching aptamers for electrochemical sensing.\n\nMicrofluidic biosensors: Lab-on-chip integrates sample preparation, separation, detection; PDMS soft lithography; droplet microfluidics for digital PCR; organ-on-chip models physiology.\n\nWearable biosensors: sweat glucose/lactate/electrolytes via skin patch; continuous ECG/heart rate; motion sensor + ECG for fall detection; closed-loop insulin pump (artificial pancreas).',
  },

  drug_discovery_process: {
    summary: 'Drug discovery transforms a biological target into an approved medicine through target identification, hit finding, lead optimization, and clinical trials spanning 10-15 years. Computational methods and high-throughput screening have modernized the process.',
    explanation: 'Pipeline stages: target identification/validation → hit finding → lead optimization → preclinical (animal studies, ADMET) → IND filing → Phase I (safety, dosing, N~20-80) → Phase II (efficacy, N~100-300) → Phase III (pivotal, N~1000-3000) → NDA → approval.\n\nTarget identification: GWAS links variants to disease, phenotypic screening, CRISPR knockout screens, proteomics (identify up/downregulated proteins); target druggability (binding pocket, surface area).\n\nHigh-throughput screening (HTS): robotic screening of 10⁶ compounds against target (biochemical or cell-based assay); 384/1536-well plates; hit rate ~0.01-0.1%; cherry-pick and retest hits.\n\nFragment-based drug discovery (FBDD): screen small, low-MW fragments (100-300 Da) at mM concentrations; SPR/NMR/X-ray to detect weak binding; grow or link fragments to drug-like molecule (MW 400-500); lower MW → better ADMET.\n\nComputational drug design: homology modeling/cryo-EM for 3D target structure; virtual screening (molecular docking: Glide, AutoDock Vina); SBDD (structure-based), LBDD (ligand-based, pharmacophore, QSAR); ML-guided lead optimization.\n\nLipinski\'s Rule of 5: oral drug candidates should have MW ≤500, logP ≤5, H-bond donors ≤5, H-bond acceptors ≤10; predicts oral bioavailability; biologics (antibodies) violate rules but delivered parenterally.',
  },

// ── MATERIALS SCIENCE (continued) ────────────────────────────

  phase_diagrams_materials: {
    summary: 'Phase diagrams map thermodynamic equilibrium phases as a function of composition and temperature. They guide alloy design, heat treatment, and processing to achieve desired microstructures and mechanical properties.',
    explanation: 'Binary phase diagram: temperature vs composition (weight or mole fraction of component B); equilibrium phases for any T,X combination; liquidus (above = all liquid), solidus (below = all solid).\n\nLever rule: in two-phase region (α+β), fraction of each phase: f_α = (X_β - X₀)/(X_β - X_α), f_β = (X₀ - X_α)/(X_β - X_α); material balance.\n\nEutectic reaction: L → α + β at eutectic point (specific composition, lowest melting T); Pb-Sn solder: eutectic at 183°C, 62%Sn/38%Pb; fine lamellar microstructure at eutectic composition.\n\nIron-Carbon diagram: critical for steel heat treatment; austenite (γ-Fe, FCC, dissolves up to 2.11 wt% C) → ferrite (α-Fe, BCC, 0.022 wt% C max) + cementite (Fe₃C) on slow cooling; eutectoid at 0.76 wt% C, 723°C (pearlite = α + Fe₃C).\n\nMartensite: BCT (body-centered tetragonal) iron supersaturated with C; formed by rapid quench of austenite (diffusionless transformation); very hard and brittle; tempering (reheat below A₁) reduces brittleness by precipitating carbides.\n\nTTT diagrams (Time-Temperature-Transformation): isothermal transformation map; nose of C-curve = maximum transformation rate; cooling curve placement determines microstructure (martensite vs bainite vs pearlite).',
  },

  corrosion_science: {
    summary: 'Corrosion is electrochemical degradation of metals through oxidation reactions with the environment. Understanding galvanic corrosion, passivation, and protection strategies is critical for extending infrastructure lifetimes and safety.',
    explanation: 'Electrochemical mechanism: anode = oxidation (Fe → Fe²⁺ + 2e⁻), cathode = reduction (O₂ + 2H₂O + 4e⁻ → 4OH⁻); electrolyte (moisture, soil, seawater) completes circuit; requires both anodic and cathodic reactions.\n\nGalvanic corrosion: two dissimilar metals in contact in electrolyte; more active (anodic) metal corrodes preferentially; galvanic series ranks metals by corrosion potential; Zn sacrificial anode protects steel (hull, underground pipes).\n\nPassivation: thin, adherent oxide layer prevents further corrosion; stainless steel (>10.5% Cr forms Cr₂O₃, 1-2nm passive film); Al spontaneously passivates (Al₂O₃); breakdown by Cl⁻ leads to pitting corrosion.\n\nPitting: localized attack at passive film defects; Cl⁻ preferentially penetrates passive film; acidic pit environment (FeCl₂ hydrolyzes); threshold Cl⁻ concentration and pitting potential.\n\nStress corrosion cracking (SCC): combination of tensile stress + corrosive environment + susceptible alloy; austenitic stainless steel + Cl⁻, brass + ammonia; prevention: material selection, stress relief, cathodic protection.\n\nCorrosion protection: organic coatings (paint, epoxy, zinc-rich primers), galvanizing (hot-dip Zn, cathodic protection via sacrificial anode), anodizing (electrochemical Al₂O₃ thickening), inhibitors (chromates, now replaced by less toxic alternatives), cathodic protection (impress current to make structure cathode).',
  },

  composite_materials: {
    summary: 'Composite materials combine two or more constituent phases to achieve properties superior to either component alone. Carbon fiber reinforced polymers (CFRP), fiberglass, and cemented carbides combine stiffness, strength, and lightweight for aerospace, automotive, and tooling applications.',
    explanation: 'Matrix + reinforcement: matrix (polymer, metal, ceramic) binds reinforcement and transfers load; reinforcement (fiber, particle, whisker) bears primary load; interface between phases is critical.\n\nRule of mixtures (fiber composites): E_c = E_f V_f + E_m V_m (longitudinal modulus, Voigt model = upper bound); 1/E_c = V_f/E_f + V_m/E_m (transverse, Reuss model = lower bound).\n\nCarbon fiber: polyacrylonitrile (PAN) precursor → stabilization (240°C) → carbonization (1300°C) → graphitization (2500°C for high modulus); T300: E=230GPa, σ_u=3.5GPa, ρ=1.76g/cm³ (vs steel: E=200GPa, σ_u=400-2000MPa, ρ=7.9g/cm³).\n\nCFRP manufacturing: prepreg (fiber + partially cured epoxy), autoclave curing (120-180°C, 3-7 bar), filament winding, RTM (resin transfer molding); anisotropic → laminate stacking sequences designed for load.\n\nCemented carbide (WC-Co): WC particles bonded by ductile Co matrix; extreme hardness (HV 1400-2000) + toughness; cutting tools, dies, drill bits; Vickers hardness vs fracture toughness tradeoff with Co content.\n\nCeramic matrix composites (CMC): SiC/SiC fiber; high temperature capability (1200-1400°C); GE LEAP jet engine hot section uses SiC/SiC CMC (25% weight reduction, higher temperature than Ni superalloy).',
  },

  energy_storage_materials: {
    summary: 'Energy storage materials — electrodes for batteries, supercapacitors, and hydrogen storage — are at the forefront of clean energy transition research. Capacity, cycle life, and safety trade-offs drive materials innovation from lithium-ion to solid-state batteries.',
    explanation: 'Lithium-ion cathode materials: LCO (LiCoO₂, 140mAh/g, phones), LFP (LiFePO₄, 170mAh/g, long cycle life, safe, EVs), NMC (LiNi_xMn_yCo_zO₂, 200mAh/g, high energy), NCA (LiNiCoAlO₂, Tesla); layered → spinel → olivine structure.\n\nAnode materials: graphite (372mAh/g, stable, commercial), silicon (3579mAh/g, 300% volume expansion → capacity fade), Si-C composites (balance), Li metal anode (plating/stripping, dendrite formation → safety risk).\n\nSolid-state batteries: solid electrolyte (LLZO, LGPS, LISICON) replaces liquid; enables Li metal anode safely; higher energy density; challenge: low ionic conductivity, high interface resistance, manufacturing.\n\nSupercapacitors (EDLC): electrostatic double-layer charge at electrode-electrolyte interface; activated carbon electrodes; high power density (10kW/kg), low energy density (5-10Wh/kg); pseudocapacitance from fast surface redox (MnO₂, RuO₂).\n\nHydrogen storage: compressed gas (350-700 bar, 5.7wt%), liquid hydrogen (-253°C, 6.5wt%), metal hydrides (MgH₂: 7.6wt%, but slow kinetics, high T required), metal-organic frameworks (MOFs, physisorption, requires cryogenic).\n\nRedox flow batteries: liquid electrolyte stored in external tanks; power (cell stack) independent from energy (tank volume); vanadium RFB (V⁴⁺/V⁵⁺, V²⁺/V³⁺, 25-year lifetime); grid-scale storage.',
  },

// ── INSTRUMENTATION (continued) ──────────────────────────────

  signal_conditioning: {
    summary: 'Signal conditioning prepares raw sensor signals for accurate digitization by amplifying weak signals, filtering noise, isolating grounds, and converting to appropriate measurement ranges through instrumentation amplifiers, filters, and isolation circuits.',
    explanation: 'Instrumentation amplifier (INA): differential amplifier with high CMRR (100-130dB), high input impedance (10⁹Ω), programmable gain; rejects common-mode interference (power line hum, cable noise); INA128, AD8221.\n\nWheatstone bridge: four-resistor bridge circuit; strain gauges, RTDs, pressure sensors; ΔV_out ≈ (ΔR/4R) × V_excitation for quarter-bridge; temperature compensation via dummy gauge; full bridge maximizes sensitivity.\n\nCharge amplifier: converts high-impedance charge source (piezoelectric accelerometer, hydrophone) to low-impedance voltage; op-amp with capacitive feedback; V_out = Q/C_f; low-frequency roll-off from feedback RC; PCB-1 vs AC-coupling.\n\nAnti-aliasing filter: low-pass filter placed before ADC; cutoff ≤ f_s/2 (Nyquist); Butterworth (flat passband, -20n dB/decade), Bessel (linear phase = constant group delay → no pulse distortion); switched-capacitor filter tracks sample rate.\n\nIsolation amplifier: galvanic isolation between input and output via optical, capacitive, or transformer coupling; safety isolation (patient protection, IEC 60601), ground loop breaking; ISO124, AMC1301.\n\nCold junction compensation: thermocouple output = V(T_hot) - V(T_cold); must measure junction temperature and add correction voltage; LT1025/AD8495 integrated CJC circuits; type K calibration table (NIST ITS-90).\n\nADC selection: resolution (12-24bit), speed (1 Sa/s sigma-delta for precision, 1 GSa/s SAR/flash for wideband), topology (sigma-delta: high resolution, low BW; SAR: medium; flash: highest speed); noise budget: quantization noise = V_FS/(√12 × 2^N) RMS.',
  },

  scanning_electron_microscope: {
    summary: 'The Scanning Electron Microscope (SEM) images surfaces at nanometer resolution by rastering a focused electron beam and collecting secondary or backscattered electrons, revealing morphology, composition, and crystallography with depth of focus superior to optical microscopy.',
    explanation: 'Operating principle: electron gun (thermionic or field emission) generates electron beam (1-30 kV); electromagnetic lenses focus to 1-20nm spot; scan coils raster beam over sample; detectors collect signals.\n\nSignal types: SE (secondary electrons, 0-50eV, surface topography, image most structures), BSE (backscattered electrons, topographic + compositional contrast, higher Z → brighter), X-ray (EDS/EDX for elemental analysis).\n\nEDX/EDS (Energy Dispersive X-ray Spectroscopy): characteristic X-ray from each element; identify elements present; semi-quantitative composition; elemental mapping at μm resolution; Li to U detectable (windowless detector for light elements).\n\nCryo-SEM: image frozen-hydrated biological samples; preserve native structure without dehydration; fracture to reveal internal structure (freeze-fracture); essential for cells, emulsions, gels.\n\nFIB-SEM (Focused Ion Beam): dual beam (Ga+ ion beam + electron beam); ion beam mills cross-sections at nm precision; serial sectioning for 3D volume reconstruction (FIB-SEM tomography); circuit edit, TEM sample preparation.\n\nVSEM (Variable Pressure SEM): image uncoated, non-conductive, hydrated samples; chamber gas partially neutralizes charge; environmental SEM at water vapor pressure → image wet biological samples in near-native state.',
  },

  temperature_sensors: {
    summary: 'Temperature sensors convert thermal energy to electrical signals using resistive (RTD, thermistor), thermoelectric (thermocouple), or radiative (pyrometer) principles. Sensor selection depends on range, accuracy, response time, and installation constraints.',
    explanation: 'Thermocouple: Seebeck effect — two dissimilar metals form EMF proportional to temperature difference; type K (Chromel-Alumel, -200 to 1260°C, most common), J (Iron-Constantan, 0-760°C), T (Copper-Constantan, -250 to 350°C), R/S/B for high temperatures (up to 1700°C, Pt alloys).\n\nRTD (Resistance Temperature Detector): Pt100/Pt1000 platinum resistor; R = R₀(1 + αT + βT² + ...); Callendar-Van Dusen equation; α = 0.00385Ω/Ω/°C for Pt; four-wire measurement eliminates lead resistance error; most accurate (-200 to 850°C).\n\nThermistor: semiconductor NTC (negative temperature coefficient, exponential R vs T); very sensitive dR/dT at room temperature; used in medical, consumer; limited range (-50 to 150°C); Steinhart-Hart equation for linearization.\n\nInfrared pyrometer: non-contact; measures emitted thermal radiation; Stefan-Boltzmann law; ratio pyrometer (two wavelengths) corrects for unknown emissivity; range 250°C to 3000°C; fast response; industrial furnaces, mold monitoring.\n\nThermal imaging (LWIR camera): focal plane array (InSb, MCT, microbolometer); images temperature distribution; 320×240 to 1920×1080 pixels; NEDT (noise-equivalent temperature difference) < 50mK; predictive maintenance, building inspection.\n\nMEMS temperature sensor: polysilicon thermopile (array of thermocouples in series); IC temperature sensors (bandgap reference: V_BE ∝ T, ADT7310, ±0.5°C accuracy); integrated with microcontroller via SPI/I²C.',
  },

  chromatography_techniques: {
    summary: 'Chromatography separates mixture components by differential partitioning between a mobile phase and stationary phase, enabling purification and analysis of complex mixtures from small molecules to proteins.',
    explanation: 'Principles: components travel through stationary phase at rates determined by affinity; retention factor k = (time in stationary - dead time)/dead time; resolution R_s = 2(t_R2-t_R1)/(w_1+w_2).\n\nGC (Gas Chromatography): volatile compounds; carrier gas (He, N₂); capillary column (30m, OV-5/DB-1 stationary phase); FID detector (universal), MS detector (identification); temperature programming for wide boiling point range.\n\nHPLC (High Performance Liquid Chromatography): non-volatile/polar compounds; solvent mobile phase; reverse-phase (C18 column, polar mobile phase, separates by hydrophobicity); UV/DAD detector; gradient elution.\n\nMass spectrometry coupling: GC-MS identifies volatiles (NIST library match); LC-MS/MS quantifies polar analytes in complex matrices (drugs in plasma, pesticides in food).\n\nIon exchange chromatography: separate by charge; cation exchange (negatively charged resin binds positive ions); used for protein purification, water softening, amino acid analysis.\n\nSize exclusion (SEC/GPC): separate by molecular size; porous beads; large molecules elute first; protein oligomerization studies; polymer molecular weight distribution.',
  },

  green_chemistry: {
    summary: 'Green chemistry designs chemical processes that minimize hazardous substances, waste, and energy consumption. The 12 Principles of Green Chemistry provide a framework for sustainable chemical synthesis and industrial processes.',
    explanation: '12 Principles (Anastas & Warner, 1998): prevent waste rather than treat; atom economy; less hazardous synthesis; safer chemicals; safer solvents/auxiliaries; energy efficiency; renewable feedstocks; reduce derivatives; catalysis; design for degradation; real-time monitoring; accident prevention.\n\nAtom economy: Trost (1991): % of atoms in starting materials incorporated into product; addition reactions: 100% atom economy; substitution: lower; rearrangement: highest.\n\nGreen solvents: water (ideal, but poor solubility for organics), supercritical CO₂ (scCO₂, tunable solubility, easily removed, caffeine decaffeination, polymer processing), ionic liquids (low vapor pressure, recyclable), deep eutectic solvents (DES).\n\nFlow chemistry (microreactors): continuous flow reactions; rapid mixing, precise temperature control, safe handling of hazardous intermediates (H₂, peroxides); reduced waste; Eli Lilly, Novartis adopt flow synthesis.\n\nBiocatalysis: enzymes as catalysts; high selectivity, mild conditions (water, room temperature, neutral pH); immobilized enzymes for reuse; transaminases for chiral amine synthesis (sitagliptin synthesis via ATA).\n\nRenewable feedstocks: bio-based polymers (PLA from corn starch, PHA from fermentation); lignocellulosic biomass valorization; platform chemicals (HMF, levulinic acid from sugars); replace petroleum-derived starting materials.',
  },

  computational_biology: {
    summary: 'Computational biology applies algorithms, statistical models, and simulations to analyze biological data and understand complex biological systems, from genome assembly to protein dynamics and systems-level network modeling.',
    explanation: 'Sequence analysis: multiple sequence alignment (Clustal Omega, MUSCLE, MAFFT); phylogenetic inference (IQ-TREE, RAxML, FastTree); motif finding (MEME, FIMO); gene prediction (Augustus, GeneMark).\n\nStructural bioinformatics: Ramachandran plot (φ,ψ angles in allowed regions); energy minimization (CHARMM, AMBER force fields); MD simulations of protein dynamics; docking (AutoDock, Glide) for drug-receptor interactions.\n\nNetwork analysis: protein-protein interaction (PPI) networks; centrality measures (degree, betweenness, eigenvector); community detection (Leiden, Louvain algorithm); disease module hypothesis; drug target identification.\n\nSingle-cell data analysis: dimension reduction (UMAP, PCA); clustering (Seurat, Scanpy); trajectory inference (Monocle3); RNA velocity; cell type annotation; multi-modal integration (scRNA + scATAC).\n\nMachine learning in biology: DeepBind (TF binding prediction), Enformer (sequence → gene expression), ESMFold (protein structure from single sequence), ProGen2 (protein sequence generation); genomic foundation models.\n\nMolecular dynamics: Newton\'s equations of motion for atoms; CHARMM/AMBER/GROMOS force fields; GROMACS/NAMD/OpenMM; umbrella sampling for free energy calculation; coarse-grained models for large systems.',
  },

  microbiology_basics: {
    summary: 'Microbiology studies microorganisms — bacteria, archaea, viruses, fungi, and protozoa — their physiology, genetics, ecology, and applications in fermentation, antibiotics, and biotechnology.',
    explanation: 'Bacterial cell structure: prokaryotic (no membrane-bound nucleus, no organelles); cell wall (peptidoglycan: Gram+: thick wall, Gram-: thin wall + outer membrane); flagella (motility, H antigen), pili (attachment, conjugation).\n\nBacterial growth: lag → exponential → stationary → death; generation time (E. coli: ~20min); growth rate μ = ln2/t_d; biofilm formation (quorum sensing via AHLs).\n\nBacterial genetics: horizontal gene transfer (conjugation: plasmid transfer via sex pilus, transformation: take up DNA from environment, transduction: phage-mediated); operons (lac operon: catabolite repression + inducer-mediated activation).\n\nAntibiotics mechanism: cell wall synthesis (β-lactams: penicillin, cephalosporin; inhibit transpeptidase), protein synthesis 30S (aminoglycosides, tetracyclines) or 50S (macrolides, chloramphenicol), DNA replication (fluoroquinolones), membrane (polymyxins).\n\nAntimicrobial resistance: β-lactamase degrades penicillin; efflux pumps export drug; target modification (MRSA: altered PBP2a); mutation in DNA gyrase (fluoroquinolone resistance); plasmid-mediated resistance spreads via conjugation.\n\nFermentation biotechnology: Saccharomyces cerevisiae for ethanol/beer/wine; lactic acid bacteria for yogurt/cheese; Aspergillus niger for citric acid; fed-batch bioreactor for antibiotics; metabolic engineering for bio-based chemicals.',
  },

  virology_basics: {
    summary: 'Virology studies viruses — obligate intracellular parasites with either DNA or RNA genomes packaged in protein capsids — including their replication cycles, pathogenesis, vaccines, and antiviral strategies.',
    explanation: 'Virus structure: nucleic acid genome (ssDNA, dsDNA, ssRNA, dsRNA, +sense, -sense, segmented) + capsid protein shell (icosahedral or helical symmetry) ± lipid envelope (from host cell membrane).\n\nReplication cycle: attachment (viral protein binds host receptor), entry (fusion or endocytosis), uncoating (genome release), replication (DNA viruses: nucleus; RNA viruses: cytoplasm), assembly, budding/lysis.\n\nRNA viruses: high mutation rate (RNA polymerase lacks proofreading); rapid evolution; antigenic drift (influenza hemagglutinin mutation) → annual flu vaccine update; antigenic shift (reassortment of segmented genome) → pandemic strains.\n\nReverse transcriptases: retroviruses (HIV: RNA → DNA via RT, integrates as provirus); SARS-CoV-2 +ssRNA directly translates then replicates via RNA-dependent RNA polymerase (RdRp, remdesivir target).\n\nViral pathogenesis: direct cytopathic effect (cell lysis), immune-mediated (CD8+ T cells kill infected cells, cytokine storm), latency (HSV in neurons, HIV in resting CD4+ T cells), transformation (HPV E6/E7 → cervical cancer).\n\nAntivirals: target viral-specific proteins; HIV: NRTIs (inhibit reverse transcriptase), PIs (protease inhibitors), INSTIs (integrase inhibitors); HCV: NS3 protease + NS5B RdRp inhibitors (95%+ cure); SARS-CoV-2: nirmatrelvir/ritonavir (Paxlovid), molnupiravir.',
  },

  neural_circuits_biology: {
    summary: 'Neural circuits are networks of neurons connected by synapses that process and transmit information in the nervous system. Action potentials, neurotransmission, and synaptic plasticity are the fundamental mechanisms of neural computation.',
    explanation: 'Neuron anatomy: soma (cell body), dendrites (inputs), axon (output, myelinated for fast conduction), axon terminals (synaptic boutons).\n\nResting membrane potential: -70mV (more negative inside); maintained by Na⁺/K⁺-ATPase (3Na⁺ out/2K⁺ in) + K⁺ leak channels; Nernst potential: E_K = -90mV, E_Na = +60mV.\n\nAction potential: voltage-gated Na⁺ channels open at -55mV threshold → rapid depolarization to +40mV; inactivation; K⁺ channels open → repolarization; refractory period; saltatory conduction in myelinated axons.\n\nSynaptic transmission: AP → Ca²⁺ influx via voltage-gated Ca²⁺ channels → vesicle fusion (SNARE complex) → neurotransmitter release → postsynaptic receptor binding → EPSP or IPSP.\n\nNeurotransmitters: glutamate (excitatory, AMPA/NMDA receptors), GABA (inhibitory, GABA-A Cl⁻ channel, GABA-B K⁺/Ca²⁺), dopamine (reward, movement, D1/D2 receptors), serotonin (mood, 5-HT receptors), acetylcholine (muscle NMJ, memory).\n\nSynaptic plasticity: LTP (long-term potentiation): high-frequency stimulation → NMDA receptor activation (Mg²⁺ block removed at depolarization) → Ca²⁺ → AMPA insertion → enhanced synapse; Hebbian learning; cellular basis of memory formation.',
  },

  magnetism_materials: {
    summary: 'Magnetic materials exhibit ferromagnetism, ferrimagnetism, or antiferromagnetism through quantum mechanical exchange interactions. Hard and soft magnetic materials enable permanent magnets, transformer cores, data storage, and spintronic devices.',
    explanation: 'Magnetic ordering: ferromagnetic (parallel spins, Fe/Ni/Co, Curie temperature), antiferromagnetic (antiparallel, Mn/Cr, Néel temperature), ferrimagnetic (unequal antiparallel, Fe₃O₄, net magnetization).\n\nExchange interaction: quantum mechanical coupling of spins; direct exchange (overlap of wavefunctions), superexchange (via oxygen orbitals in oxides), RKKY (itinerant electrons in metals).\n\nMagnetic domains: regions of uniform magnetization; separated by domain walls (Bloch wall, Néel wall); minimizes magnetostatic energy; domain structure revealed by Kerr microscopy, MFM.\n\nHysteresis loop: M vs H (or B vs H); coercivity H_c (field to demagnetize), remanence M_r (magnetization at H=0), saturation M_s; hard magnets (high H_c: NdFeB, SmCo) for permanent magnets; soft magnets (low H_c: Si-Fe, MnZn ferrite) for transformers.\n\nNdFeB permanent magnets: Nd₂Fe₁₄B; highest energy product (up to 56 MGOe); used in EV motors, wind turbines, MRI, speakers, hard drives; China produces 85% of global supply; supply chain concern.\n\nSpintronics: use electron spin + charge; GMR (giant magnetoresistance, Nobel 2007): resistance depends on relative orientation of magnetic layers → read heads in hard drives; TMR (tunneling magnetoresistance) in modern HDDs; MRAM (non-volatile memory).',
  },

  additive_manufacturing_mat: {
    summary: 'Additive manufacturing (3D printing) builds parts layer by layer from digital designs. Metal AM (SLM, EBM) produces near-net-shape aerospace and medical implants; polymer AM (FDM, SLA) enables rapid prototyping and customized parts.',
    explanation: 'FDM (Fused Deposition Modeling): thermoplastic filament (PLA, ABS, PETG, Nylon) melted through nozzle, deposited layer by layer; low cost, easy material change; layer adhesion limits mechanical properties; support structures for overhangs.\n\nSLA/DLP (Stereolithography/Digital Light Processing): UV photopolymerization of resin; SLA uses laser scanning point; DLP projects entire layer at once (faster); high resolution (25-100μm); smooth surface; brittle unless flexibilizers added.\n\nSLS (Selective Laser Sintering): CO₂ laser sinters polymer powder (Nylon-12 PA2200); no support required (unfused powder supports); isotropic mechanical properties; surface roughness from powder particle size.\n\nSLM/LPBF (Selective Laser Melting): fully melt metal powder (316L SS, Ti-6Al-4V, IN718, AlSi10Mg); fine microstructure from rapid solidification; residual stress and distortion; post-processing (HIP, heat treatment) improves fatigue; aerospace (GE LEAP fuel nozzle).\n\nEBM (Electron Beam Melting): vacuum environment; faster than SLM; high temperature (750°C) reduces residual stress; Ti-6Al-4V for orthopedic implants (osseointegration via lattice structures).\n\nTopology optimization: FEA-driven material removal to minimize weight for given loads and boundary conditions; produces organic-looking structures not manufacturable by conventional methods; AM enables these geometries; 30-60% weight savings in aerospace brackets.',
  },

  polymer_physics: {
    summary: 'Polymer physics applies statistical mechanics to describe the conformations, dynamics, and phase behavior of long-chain macromolecules, explaining rubber elasticity, viscoelasticity, self-assembly of block copolymers, and polymer solutions.',
    explanation: 'Random walk model: freely jointed chain of N bonds of length l; end-to-end distance R_e = √(N)·l (random walk); mean ⟨R_e²⟩ = Nl²; flexible polymers in solution adopt random coil conformation.\n\nFlory parameter ν: R ∝ N^ν; ideal chain (theta conditions): ν=0.5; good solvent (excluded volume): ν≈0.6 (Flory: ν=3/5); poor solvent (collapsed): ν=1/3.\n\nRubber elasticity: crosslinked network; entropic elasticity — stretching decreases conformational entropy; restoring force f = k_BT × (3/Nl²) × r (Gaussian chain); Young\'s modulus E = ρ_chain × k_BT × N_A / M₀.\n\nViscoelasticity: polymer melts are viscoelastic (both viscous liquid and elastic solid behavior depending on frequency); Maxwell model (spring + dashpot in series); time-temperature superposition (WLF equation); reptation model (de Gennes): polymer chain moves in tube formed by entanglements → viscosity η ∝ M³.\n\nGlass transition (Tg): entropy theory (free volume) — below Tg, free volume insufficient for chain motion; WLF equation describes shift factor; Tg depends on chain flexibility, side groups, molecular weight.\n\nBlock copolymer self-assembly: amphiphilic diblock (A-B) microphase separates into nanostructures (lamellar, cylinders, spheres, bicontinuous gyroid); χ (Flory-Huggins parameter, A-B incompatibility) × N determines morphology (χN>10.5 for phase separation); templating for nanopatterning.',
  },

  photovoltaic_materials: {
    summary: 'Photovoltaic materials convert sunlight to electricity via the photovoltaic effect. Silicon dominates commercial solar cells, while perovskites, CdTe, and organic materials offer alternative approaches with distinct efficiency-cost trade-offs.',
    explanation: 'p-n junction solar cell: photon with E > E_g excites electron-hole pair; built-in field at junction separates carriers; photocurrent J_ph; open-circuit voltage V_oc = (k_BT/q) ln(J_ph/J_0+1); efficiency η = J_sc × V_oc × FF / P_incident.\n\nShockley-Queisser limit: thermodynamic efficiency limit ~33% for single-junction at 1.34eV bandgap; losses: sub-bandgap photons (not absorbed), thermalization (excess energy lost as heat), recombination.\n\nMono/poly crystalline silicon: 26.7% lab record, 22-24% commercial monocrystalline; PERC (Passivated Emitter Rear Cell), TOPCon, heterojunction (HJT); passivation reduces surface recombination; standard for utility-scale.\n\nThin-film: CdTe (commercial, First Solar, 22.1% record, Cd toxicity concern), CIGS (Cu(In,Ga)Se₂, 23.4% record, complex deposition), amorphous Si (a-Si, low cost, low efficiency, degrades under light).\n\nPerovskite (ABX₃): CH₃NH₃PbI₃; 26.1% single junction record (2024); low cost, solution processable; instability (moisture, heat, UV degradation) and Pb toxicity are challenges; 33.9% record for perovskite/silicon tandem.\n\nMulti-junction: III-V semiconductors (GaInP/GaAs/Ge); 47.6% record under concentration; used in space satellites; costly for terrestrial without concentration (CPV).',
  },

  ceramics_engineering: {
    summary: 'Engineering ceramics are inorganic, non-metallic materials with covalent/ionic bonding, exhibiting high hardness, temperature resistance, and chemical stability. They enable cutting tools, thermal barriers, electronic components, and biomedical implants.',
    explanation: 'Crystal structures: ionic (NaCl, CsCl, ZnS wurtzite, fluorite), covalent (diamond cubic, SiC), complex oxides (spinel AB₂O₄, perovskite ABO₃).\n\nProperties: high hardness (SiC 2500HV, Al₂O₃ 2000HV), high melting point (Al₂O₃ 2072°C, ZrO₂ 2715°C), low thermal conductivity, low thermal expansion, chemically inert, brittle (low K_Ic ~1-5 MPa√m vs steel 50-200).\n\nManufacturing: powder processing → shaping (pressing, extrusion, injection molding, slip casting) → sintering (densification by diffusion, 1200-1800°C); hot pressing/HIP for full density; grain size control critical for properties.\n\nToughening mechanisms: transformation toughening (ZrO₂: tetragonal→monoclinic at crack tip, volume expansion, compressive stress stops crack, K_Ic up to 10 MPa√m); fiber reinforcement (SiC fibers in SiC matrix, CMC).\n\nAlumina (Al₂O₃): most widely used; 99.9% purity for electronic substrates; wear resistant; biomedical (hip socket); laser gain medium (ruby = Cr-doped Al₂O₃, sapphire = undoped).\n\nThermal barrier coating (TBC): YSZ (yttria-stabilized zirconia) on turbine blades; low thermal conductivity (2.5 W/mK vs 12 for superalloy); allows 200°C higher gas temperature → efficiency improvement; applied by APS or EB-PVD.',
  },

  shape_memory_alloys: {
    summary: 'Shape memory alloys (SMAs) recover their original shape upon heating after plastic deformation, via a reversible diffusionless martensitic phase transformation. NiTi (Nitinol) enables actuators, medical stents, and eyeglass frames.',
    explanation: 'Mechanism: austenite (high T, cubic, ordered) → martensite (low T, monoclinic, twinned); martensite easily deformed (detwinning); heat above A_f → returns to austenite shape; shape memory effect (SME).\n\nSuperelasticity: above A_f, stress-induced martensitic transformation; large recoverable strain (8-10%) under load; rubber-like behavior without elastomer; NiTi wires in orthodontics, flexible electronics.\n\nNiTi (Nitinol): ~50at% Ni; transformation temperatures tunable -20 to 110°C by Ni:Ti ratio; biocompatible; corrosion resistant; 4-8% recoverable strain; high cycle fatigue life; cardiovascular stents, guide wires, filters.\n\nTwo-way SME: alloy remembers both hot and cold shapes (requires training — cycling under stress); smaller recoverable strain; actuator applications.\n\nActuators: electrical resistance heating enables Joule-heated SMA actuators; compact, silent, high force/weight ratio (50-200 N/g); but slow cooling limits cycling frequency to ~1Hz; robotic grippers, deployment mechanisms.\n\nCu-based SMAs (CuZnAl, CuAlNi): cheaper than NiTi; higher transformation temperatures; but polycrystalline brittleness and intergranular cracking limit applications; Fe-Mn-Si for large scale structural actuation.',
  },

  biomaterials: {
    summary: 'Biomaterials interface with biological systems for medical applications — implants, prosthetics, tissue engineering scaffolds, drug delivery vehicles. Biocompatibility, mechanical matching, and controlled degradation govern material selection.',
    explanation: 'Biocompatibility: material does not elicit harmful host response; ISO 10993 standard tests; cytotoxicity, sensitization, genotoxicity, implantation tests; protein adsorption precedes cell adhesion — determines biological response.\n\nMetallic biomaterials: 316L stainless steel (hip screws, plates), Ti-6Al-4V (osseointegrated implants, dental), CoCrMo (total joint replacements); surface treatments: sandblasting + acid etching enhances osseointegration; Ti oxide passivation layer biocompatible.\n\nPolymer biomaterials: UHMWPE (ultra-high molecular weight polyethylene, joint replacement bearing surface), PTFE (vascular grafts), PEEK (spinal cages), silicone (breast implants, catheters); degradable: PLA, PLGA (drug delivery, tissue engineering scaffolds).\n\nHydrogels: water-swollen crosslinked polymer networks; mimic soft tissue ECM; PEG, alginate, gelatin methacrylate; tunable mechanical properties (0.1-100 kPa, match brain to cartilage); cell encapsulation; 3D bioprinting.\n\nTissue engineering: scaffold + cells + growth factors; scaffold provides 3D structure for cell infiltration and differentiation; biodegradable scaffold resorbs as tissue forms; decellularized ECM as natural scaffold; clinical: skin grafts, bladder, trachea.\n\nDrug delivery systems: controlled release via diffusion/erosion; PLA/PLGA microspheres (weeks to months release); liposomes (amphiphilic, encapsulate hydrophilic and hydrophobic drugs); nanoparticles (EPR effect for tumor targeting); hydrogel depots for protein therapeutics.',
  },

  inorganic_chemistry_basics: {
    summary: 'Inorganic chemistry studies non-carbon-based compounds — metals, transition metal complexes, minerals, and main group compounds — including coordination chemistry, solid-state materials, and organometallic catalysis.',
    explanation: 'Coordination compounds: central metal ion + ligands (Lewis bases: NH₃, Cl⁻, CN⁻, en, EDTA); coordination number (4-8); coordination geometries: octahedral (most common, 6-coordinate), tetrahedral, square planar.\n\nCrystal field theory: d-orbital splitting by ligand field; octahedral field splits d orbitals into t₂g (3, lower) and eg (2, higher); Δ_oct = crystal field splitting energy; spectrochemical series: I⁻ < Br⁻ < Cl⁻ < F⁻ < OH⁻ < H₂O < NH₃ < CN⁻ (weak to strong field).\n\nHigh-spin vs low-spin: strong field ligands (CN⁻, CO) → large Δ → low spin (all paired in t₂g); weak field ligands (F⁻, H₂O) → small Δ → high spin (electrons in eg); affects magnetic properties and reactivity.\n\nTransition metal catalysis: d electrons facilitate oxidative addition, reductive elimination, migratory insertion; Wilkinson\'s catalyst (Rh), Grubbs (Ru, olefin metathesis), palladium cross-coupling (Suzuki, Heck, Negishi).\n\nMain group chemistry: Group 1/2 (ionic, Lewis acid catalysts), Group 13 (AlCl₃ Lewis acid, boron hydrides), Group 14 (Si chemistry, silicones, carbides), Group 15 (phosphorus: phosphines as ligands, fertilizers), Group 16 (sulfur: H₂SO₄, thiols), Group 17 (halogens: oxidants).\n\nSolid-state inorganic: ionic crystals (NaCl, CaF₂, ZnS), mixed oxides (perovskites ABO₃: BaTiO₃ ferroelectric, LaMnO₃ magnetic), spinels (AB₂O₄), zeolites (microporous aluminosilicates, shape-selective catalysts, ion exchange).',
  },

  laser_physics: {
    summary: 'Laser physics explains coherent light generation through stimulated emission in gain media with optical feedback. Pulsed laser techniques — Q-switching, mode-locking — generate nanosecond to femtosecond pulses for ultrafast science and precision manufacturing.',
    explanation: 'Einstein coefficients: A₂₁ (spontaneous emission, rate ∝ population N₂), B₂₁ (stimulated emission, rate ∝ N₂×ρ_ν), B₁₂ (absorption, rate ∝ N₁×ρ_ν); at thermal equilibrium stimulated emission < absorption; inversion required.\n\nPopulation inversion: three-level (ruby: pump to level 3, fast decay to level 2, lase 2→1, ground state is lower laser level — hard to maintain) vs four-level (Nd:YAG: ground state different from lower laser level — easy inversion).\n\nOptical cavity: two mirrors forming Fabry-Perot resonator; modes at λ_n = 2L/n; gain bandwidth selects which modes oscillate; single longitudinal mode operation for narrow linewidth; ring cavity eliminates spatial hole burning.\n\nQ-switching: rapidly restore cavity Q after gain buildup → giant nanosecond pulse; acousto-optic or electro-optic Q-switch; peak power MW-GW; Nd:YAG material processing, range finding, LIDAR.\n\nMode-locking: phase-lock multiple longitudinal modes; constructive interference → very short pulse, τ ≈ 1/Δν; passive mode-locking (SESAM, Kerr lens); Ti:Sapphire → 5-100 fs pulses; frequency comb (Nobel 2005); ultrafast spectroscopy, ophthalmology (LASIK).\n\nLaser-matter interaction: ablation threshold fluence J/cm²; thermal (CW/long pulse) vs non-thermal (fs pulse, too fast for heat diffusion → material removed before heating); cold ablation for precision (corneal sculpting, PCB drilling).',
  },

  thermal_analysis_mat: {
    summary: 'Thermal analysis techniques — DSC, TGA, TMA, DMA — characterize materials by measuring their physical and chemical properties as a function of temperature, revealing phase transitions, decomposition, glass transition, and thermal stability.',
    explanation: 'DSC (Differential Scanning Calorimetry): measures heat flow difference between sample and reference as both are heated/cooled at controlled rate; endothermic events (melting, glass transition, denaturation), exothermic (crystallization, curing, oxidation).\n\nGlass transition (DSC): step change in heat capacity at Tg; onset, midpoint, end temperatures reported; heating rate affects apparent Tg; modulated DSC (MDSC) separates reversible (Tg) from irreversible (curing, decomposition) heat flow.\n\nTGA (Thermogravimetric Analysis): mass vs temperature; volatile loss, decomposition, oxidation; derivative TGA (DTG) shows rate of mass change; coupled with MS or FTIR for evolved gas analysis; moisture content, filler content in composites.\n\nDMA (Dynamic Mechanical Analysis): oscillatory stress/strain; storage modulus E\' (elastic), loss modulus E\'\' (viscous), tan δ = E\'/E\'\'; glass transition (tan δ peak); viscoelastic behavior of polymers; temperature-frequency sweeps.\n\nTMA (Thermomechanical Analysis): dimensional change vs temperature; coefficient of thermal expansion (CTE); softening point; penetration probe for Tg; Vicat softening point; critical for PCB laminate selection (CTE mismatch).\n\nSTA (Simultaneous TGA-DSC): measure both simultaneously on same sample; eliminates sample variability; standard for polymer, ceramic, pharmaceutical characterization; temperature range -150°C to 1600°C.',
  },

  colloid_chemistry: {
    summary: 'Colloid science studies dispersions of particles (1nm-1μm) in a medium, governing emulsions, foams, aerosols, and nanoparticle suspensions. Colloidal stability, controlled by electrostatic and steric repulsion, is central to paints, cosmetics, and drug delivery.',
    explanation: 'Colloidal systems: sol (solid in liquid), emulsion (liquid in liquid), foam (gas in liquid), aerosol (liquid/solid in gas), gel (liquid in solid network); size range 1-1000 nm between solutions and suspensions.\n\nDLVO theory: total potential = electrostatic repulsion (from surface charge, zeta potential) + van der Waals attraction; secondary minimum (loose flocculation) vs primary minimum (coagulation); salt addition screens repulsion → coagulation (Schulze-Hardy rule: critical coagulation concentration ∝ z⁻⁶).\n\nZeta potential: electrical potential at shear plane of diffuse double layer; measured by electrophoretic light scattering; |ζ| > 30mV → stable dispersion; |ζ| < 10mV → unstable; pH adjusts surface charge (oxides have point of zero charge).\n\nSteric stabilization: polymer chains adsorbed/grafted on particle surface; entropic repulsion when chains overlap; requires polymer layer thickness > attractive range (~10nm); polyethylene glycol (PEG) coating for nanoparticles in biological media.\n\nEmulsification: surfactant stabilizes oil-water interface; HLB (Hydrophile-Lipophile Balance) value determines emulsification; HLB 4-6: W/O emulsion; HLB 8-18: O/W emulsion; Pickering emulsions stabilized by solid particles.\n\nDynamic light scattering (DLS): measure particle size via Brownian motion; autocorrelation of scattered light intensity; hydrodynamic radius via Stokes-Einstein D = k_BT/(6πηr_h); polydispersity index (PDI); gold standard for nanoparticle size measurement.',
  },

  environmental_chemistry: {
    summary: 'Environmental chemistry studies chemical processes in air, water, and soil, including pollutant transport, transformation, and fate. It underpins air quality modeling, water treatment, soil remediation, and climate chemistry.',
    explanation: 'Atmospheric chemistry: troposphere (0-12km): photochemical smog (O₃, NOx, VOC cycles), OH radical (hydroxyl, primary atmospheric oxidant, reacts with CH₄, CO, VOCs), aerosol formation (nucleation, growth, coagulation).\n\nStratospheric ozone: Dobson units; Chapman cycle (O₂ + hν → 2O, O + O₂ → O₃, O₃ + hν → O₂ + O); halogen catalytic cycles: Cl + O₃ → ClO + O₂, ClO + O → Cl + O₂ (net: O + O₃ → 2O₂); Cl₂ from CFC photolysis; Montreal Protocol (1987).\n\nWater chemistry: hardness (Ca²⁺ + Mg²⁺, scale in pipes, reduced soap efficacy); alkalinity (HCO₃⁻, CO₃²⁻, buffer for pH); BOD (Biochemical Oxygen Demand, organic load); COD (Chemical Oxygen Demand); nutrient cycle (N, P → eutrophication).\n\nHenry\'s law: partitioning between water and atmosphere: c_water = K_H × p_gas; K_H depends on T; CO₂ absorption by oceans (ocean acidification: pH fell from 8.2 to 8.1 since industrial revolution).\n\nPollutant fate: persistence (half-life), bioaccumulation (log K_ow > 5 → bioaccumulation in fat), bioavailability (fraction accessible to organisms); PAHs, PCBs, DDT are persistent organic pollutants (POPs).\n\nRemediation: pump-and-treat (contaminated groundwater), soil vapor extraction (volatile organics), phytoremediation (plants accumulate heavy metals or degrade organics), bioremediation (microorganisms degrade contaminants), activated carbon sorption.',
  },

  radiation_biology: {
    summary: 'Radiation biology studies the effects of ionizing radiation (X-rays, γ-rays, neutrons, charged particles) on biological systems, from DNA damage and cell killing to mutagenesis and carcinogenesis, informing radiotherapy and radiation protection.',
    explanation: 'Radiation types and LET: X-rays/γ-rays (low LET, ~0.3 keV/μm, sparsely ionizing), protons (~3 keV/μm at peak), α particles (~100 keV/μm, high LET, densely ionizing); high LET → more clustered DNA damage → harder to repair.\n\nBiological effects: direct (radiation directly ionizes DNA molecule) vs indirect (radiation ionizes water → OH• radical → damages DNA); OH• causes ~70% of low-LET radiation damage.\n\nDNA damage: single-strand breaks (SSB, easily repaired), double-strand breaks (DSB, more lethal, repaired by NHEJ or HR), base modifications, crosslinks; ~40 DSB per Gy per cell.\n\nCell survival curves: linear-quadratic (LQ) model: -ln S = αD + βD²; α/β ratio determines repair capacity; α/β high (~10Gy) for acutely responding tissues (tumor, gut); α/β low (~3Gy) for late-responding (spinal cord).\n\nRadiotherapy: fractionated delivery (2Gy/fraction, 30 fractions) → repair of sublethal damage between fractions, repopulation; tumor hypoxia reduces radiosensitivity (oxygen enhancement ratio OER ~3); IMRT, VMAT dose sculpting; proton therapy (Bragg peak).\n\nRadiation protection: ALARA; effective dose (mSv) = absorbed dose (Gy) × radiation weighting factor × tissue weighting factor; stochastic effects (cancer, hereditary) probabilistic; deterministic effects (acute radiation syndrome) threshold-based; ICRP dose limits: 20 mSv/year workers, 1 mSv/year public.',
  },

  impedance_spectroscopy: {
    summary: 'Electrochemical Impedance Spectroscopy (EIS) sweeps AC frequency to extract equivalent-circuit parameters (charge-transfer resistance, double-layer capacitance, Warburg diffusion) for batteries, corrosion, and biosensors.',
    explanation: 'Measurement: apply small-amplitude AC voltage (5-10mV) at frequency f; measure resulting current; Z(f) = V(f)/I(f) = Z\'(f) + jZ\'\'(f) (complex impedance); sweep frequency 0.01Hz to 1MHz.\n\nNyquist plot: -Z\'\' vs Z\'; semicircle = RC parallel element; diameter = charge transfer resistance R_ct; x-intercept = electrolyte resistance R_s; slope 45° line = Warburg (diffusion); low-frequency intercept = total resistance.\n\nEquivalent circuit elements: R (resistor, real impedance), C (capacitor, 1/jωC), L (inductor, jωL), Warburg W (semi-infinite diffusion, Z_W = σω^(-1/2)(1-j)), CPE (constant phase element, empirical for rough surfaces).\n\nRandles cell: R_s (electrolyte) + parallel combination of C_dl (double-layer capacitance) and R_ct (charge transfer) + Warburg; model for many electrochemical systems; fit to extract kinetic parameters.\n\nBattery characterization: EIS reveals SOH (state of health); charge transfer resistance increases with aging; diffusion impedance changes; EIS at different SOC enables battery model parameter identification.\n\nBiosensor applications: EIS label-free detection of binding events at electrode surface; binding changes C_dl and R_ct; specific antibody/aptamer captures analyte → measurable impedance change; cancer biomarker detection at fM concentrations.',
  },

  // ════ B14 ════


// ── Numerical Methods ────────────────────────────────────────

  floating_point_arith: {
    summary: 'IEEE 754 standard for representing real numbers in binary with finite precision, covering special values and rounding behavior.',
    explanation: 'Float32 layout: Sign(1 bit) + Exponent(8 bits, biased by 127) + Mantissa(23 bits), giving ~7 decimal digits of precision.\nSpecial values: ±∞ (exponent all 1s, mantissa 0), NaN (exponent all 1s, mantissa ≠ 0), ±0, denormals (exponent 0, gradual underflow).\nMachine epsilon ε_mach ≈ 2.2e-16 for float64; smallest value such that fl(1 + ε) ≠ 1.\nRounding modes: round-to-nearest-even (default, banker\'s rounding), round-toward-zero, ±∞.\nCatastrophic cancellation: subtracting nearly equal numbers annihilates significant bits, e.g., (1+x)-1 for tiny x.\nKahan summation compensates for rounding in sums; fp16/bf16/fp8 formats trade precision for memory/compute in ML training.',
  },
  numerical_integration_quad: {
    summary: 'Numerical approximation of definite integrals using quadrature rules of varying accuracy and adaptivity.',
    explanation: 'Newton-Cotes rules: trapezoid rule error O(h²), Simpson\'s rule O(h⁴) — composite versions over n subintervals.\nGaussian quadrature: n-point rule integrates polynomials of degree ≤ 2n-1 exactly; nodes/weights from orthogonal polynomial roots.\nGauss-Legendre for [−1,1], Gauss-Hermite for (−∞,∞) with e^{−x²} weight, Gauss-Laguerre for [0,∞).\nAdaptive quadrature (QUADPACK, scipy.integrate.quad): estimate error by comparing coarse/fine grids, recursively subdivide where error large.\nRomberg integration: apply Richardson extrapolation to trapezoid sequence → rapid convergence for smooth functions.\nMonte Carlo integration: rate 1/√N independent of dimension, preferred for d > 8; variance reduction via importance sampling.',
  },
  ode_runge_kutta: {
    summary: 'Numerical methods for solving ordinary differential equations via stage-based approximations, including adaptive step-size control.',
    explanation: 'General explicit RK: y_{n+1} = y_n + h·Σ_i b_i k_i where k_i = f(t_n + c_i h, y_n + h·Σ_j a_{ij} k_j); coefficients in Butcher tableau.\nClassical RK4: 4 stages, 4th-order accuracy, 4 function evaluations per step — dominant for smooth non-stiff problems.\nEmbedded pairs (e.g., Dormand-Prince RK45): compute 4th and 5th order estimates, difference gives local error → adaptive step control with PI controller.\nImplicit methods: trapezoidal (2nd order, A-stable), implicit Euler (1st, L-stable), Gauss-Legendre (2nd-order, symplectic for Hamiltonian systems).\nStiffness: explicit methods require tiny h when max eigenvalue of Jacobian ≫ min; implicit methods use Newton solve per step but allow large h.\nLSODA (scipy.integrate.odeint): automatically switches between non-stiff (Adams-Moulton) and stiff (BDF) solvers.',
  },
  pde_finite_difference: {
    summary: 'Discretize partial differential equations on uniform grids, approximating derivatives by finite differences.',
    explanation: 'Spatial derivatives: forward Δ+u = (u_{i+1}-u_i)/h (1st order), central δu = (u_{i+1}-u_{i-1})/(2h) (2nd order), second derivative (u_{i+1}-2u_i+u_{i-1})/h².\nHeat equation u_t = α u_xx: explicit FTCS stable iff r = αΔt/Δx² ≤ 1/2 (1D); implicit backward Euler unconditionally stable; Crank-Nicolson (CN) 2nd order in time.\nPoisson equation ∇²u = f: assemble sparse linear system, solve with direct (small), iterative (large) methods including Gauss-Seidel, SOR.\nWave equation u_tt = c²u_xx: CFL condition Δt ≤ Δx/c for stability of leapfrog scheme.\nBoundary conditions implemented via ghost cells (periodic), Dirichlet (direct substitution), Neumann (one-sided differences).\nHigher-order compact schemes (e.g., 4th order Padé) trade bandwidth for accuracy on smooth solutions.',
  },
  finite_element_method: {
    summary: 'Variational approach to solving PDEs by decomposing the domain into elements and approximating the solution with basis functions.',
    explanation: 'Weak formulation: multiply PDE by test function v, integrate by parts → ∫∇v·∇u dΩ = ∫vf dΩ; reduces smoothness requirement on solution.\nDiscretize Ω into elements (triangles in 2D, tetrahedra in 3D); choose polynomial basis functions (hat, Lagrange, Hermite) on each element.\nAssemble global stiffness matrix K_{ij} = ∫∇φ_i·∇φ_j dΩ and load vector F_i = ∫φ_i f dΩ; apply boundary conditions; solve Ku = F.\nGalerkin method: test and trial functions from same space; Petrov-Galerkin uses different spaces (e.g., for advection-dominated problems).\nA priori error: ||u−u_h||_{H¹} ≤ Ch^p |u|_{H^{p+1}} for degree-p elements; h-refinement reduces element size, p-refinement increases polynomial degree.\nFEnICS, deal.II, FEniCSx: modern FEM frameworks; hp-FEM combines both refinements for exponential convergence on smooth problems.',
  },
  finite_volume_method: {
    summary: 'Discretize conservation laws by integrating over control volumes, ensuring exact discrete conservation of mass, momentum, and energy.',
    explanation: 'Starting from divergence form: ∂_t ρ + ∇·F = 0; integrate over cell C_i: d/dt ∫_{C_i} ρ dV = −∮_{∂C_i} F·n dA.\nFlux F at cell faces: upwind (1st order, stable), central (2nd order, unstable for advection), MUSCL with limiter (2nd order, TVD).\nGodunov scheme: solve exact Riemann problem at each interface → upwind-biased, captures shocks without oscillations.\nHigh-resolution methods: TVD limiters (minmod, van Leer, superbee) ensure monotonicity; ENO/WENO (5th-7th order) for smooth regions + shock capturing.\nTime integration: explicit (RK3-TVD for compressible flow), implicit for low-Mach regimes.\nApplications: Euler/Navier-Stokes equations in CFD (OpenFOAM, SU2), shallow water, FDTD for Maxwell\'s equations.',
  },
  spectral_methods_pde: {
    summary: 'Represent PDE solutions as global basis function expansions, achieving exponential convergence for smooth problems.',
    explanation: 'Represent u(x) = Σ û_k φ_k(x); derivatives computed exactly in spectral space (differentiation matrix is diagonal for Fourier).\nFourier spectral: for periodic domains; Chebyshev expansion for non-periodic — points cluster at boundaries avoiding Runge phenomenon.\nExponential (spectral) convergence: for analytic u, ||u − u_N|| ~ O(r^{−N}) for some r > 1, vastly outpacing O(h^p) methods.\nPseudospectral (collocation): evaluate nonlinear terms at physical points, transform to spectral for differentiation, back-transform — avoids convolution sums.\nSpectral element method (SEM): partition domain into elements, use high-order Gauss-Lobatto-Legendre basis per element; combines spectral accuracy + geometric flexibility.\nApplications: global weather/climate models (spherical harmonics), turbulence (DNS), quantum mechanics (time-splitting).',
  },
  monte_carlo_integration: {
    summary: 'Use random sampling to estimate integrals and expectations, with convergence rate independent of dimension.',
    explanation: 'Basic estimator: I ≈ (1/N) Σ_{i=1}^N f(x_i) where x_i ~ uniform[a,b]; unbiased, variance σ²/N, error O(N^{−1/2}).\nUnlike deterministic quadrature O(h^p), MC error O(N^{−1/2}) holds in any dimension d — essential for d > 8 integrals.\nImportance sampling: sample from q(x) ∝ |f(x)|, estimator Σ f(x_i)/q(x_i)/N; reduces variance when q approximates |f|.\nControl variates: I_f ≈ I_g (known) + (1/N)Σ[f(x_i)−g(x_i)]; stratified sampling partitions domain; antithetic variates use x and 1−x.\nQuasi-Monte Carlo: low-discrepancy sequences (Halton, Sobol, Faure) fill space more uniformly, achieving O(N^{−1} log^d N) rate.\nMCMC (Markov Chain Monte Carlo): sample from complex p(x) ∝ π(x) via Metropolis-Hastings accept/reject; HMC uses gradient information for efficiency.',
  },
  iterative_linear_solvers: {
    summary: 'Iterative methods for solving large sparse linear systems Ax = b, exploiting Krylov subspace structure for efficiency.',
    explanation: 'Conjugate Gradient (CG): for symmetric positive definite (SPD) A; minimizes energy norm of error over Krylov subspace K_k(A,r₀); convergence in O(√κ) iterations where κ = σ_max/σ_min.\nGMRES: for non-symmetric A; minimizes ||Ax−b||₂ over K_k(A,r₀) via Arnoldi process; restart to bound memory (GMRES(m)).\nBiCGSTAB: non-symmetric alternative, O(n) per iteration (vs GMRES O(kn)), less smooth convergence but memory-efficient.\nPreconditioning M: solve M⁻¹Ax = M⁻¹b; good M approximates A⁻¹ while being cheap to apply; ILU(0), ILUT, Jacobi, block-Jacobi, AMG preconditioners.\nMultigrid: V-cycle performs smoothing at fine grid, restrict residual to coarse grid, solve, prolongate correction; achieves O(N) complexity for elliptic PDE.\nConvergence stagnation signals ill-conditioning; monitor residual norm, apply different preconditioner or switch to direct solver.',
  },
  direct_linear_solvers: {
    summary: 'Direct factorization methods for solving Ax = b in finite steps, with guaranteed accuracy and predictable cost.',
    explanation: 'Gaussian elimination: O(n³/3) flops; with partial pivoting (LU = PA) numerically stable for most matrices.\nCholesky A = LL^T: for SPD matrices, O(n³/6) flops — half of LU; fails if A not PSD; update/downdate for incremental problems.\nQR decomposition (Householder or Givens): A = QR; solve R x = Q^T b; preferred for least squares Ax ≈ b — avoids squaring condition number.\nBanded/tridiagonal systems: bandwidth bw → O(n·bw²) for LU; Thomas algorithm O(n) for tridiagonal; common in 1D FD/FE.\nSparse direct solvers: UMFPACK (unsymmetric), CHOLMOD (symmetric), MKL PARDISO, SuperLU; fill-reducing orderings (AMD, METIS) minimize structural fill-in during factorization.\nLAPACK (CPU) and MAGMA (GPU) provide standards; ScaLAPACK for distributed memory; pivoting strategies balance stability vs fill.',
  },
  eigenvalue_algorithms: {
    summary: 'Algorithms for computing eigenvalues and eigenvectors of matrices, ranging from simple power iteration to state-of-the-art Krylov methods.',
    explanation: 'Power iteration: x_{k+1} = Ax_k/||Ax_k||; converges to dominant eigenvector at rate |λ₁/λ₂|; shifted inverse iteration (A−σI)⁻¹x for any eigenvalue.\nQR algorithm: reduce A to upper Hessenberg (O(n³)), apply QR iterations with shifts (Francis double-shift) → converges to quasi-upper-triangular (Schur form).\nArnoldi iteration: build orthonormal basis of Krylov space K_k(A,v); Ritz pairs approximate eigenvalues; Lanczos for symmetric A (tridiagonal reduction).\nIMPLICITLY RESTARTED Arnoldi (ARPACK): compute k < n largest/smallest/interior eigenvalues of sparse A; widely used in scipy.sparse.linalg.eigs.\nSVD A = UΣV^T via Golub-Reinsch bidiagonalization; σ_i = √(eigenvalues of A^T A); randomized SVD for approximate low-rank decomposition.\nGeneralized eigenvalue Ax = λBx: Cholesky B = LL^T, transform to standard; or Krylov methods (ARPACK supports B-orthogonality).',
  },
  numerical_optimization: {
    summary: 'Algorithms for finding minima of continuous functions, from gradient-based first-order methods to second-order Newton approaches.',
    explanation: 'Gradient descent: x_{k+1} = x_k − α_k ∇f(x_k); convergence rate O(1/k) for convex, O(ρ^k) linear for strongly convex.\nLine search: find α satisfying Wolfe conditions (sufficient decrease + curvature condition) for guaranteed descent.\nNewton\'s method: x_{k+1} = x_k − H(x_k)⁻¹ ∇f(x_k) where H = ∇²f; quadratic convergence near minimizer; O(n³) per step for dense H.\nQuasi-Newton BFGS: approximate H⁻¹ via rank-2 updates from gradient differences, superlinear convergence, O(n²) memory; L-BFGS stores only m vector pairs, O(mn) memory for large-scale.\nTrust region: find d minimizing quadratic model within ball ||d|| ≤ Δ; adjust Δ based on actual vs predicted decrease; more robust than line search.\nAutomatic differentiation: forward mode (dual numbers) for few inputs, reverse mode (backpropagation) for few outputs; exact gradients to machine precision.',
  },
  root_finding_methods: {
    summary: 'Algorithms for finding x where f(x) = 0, trading convergence speed for robustness and derivative requirements.',
    explanation: 'Bisection method: bracket [a,b] with f(a)f(b) < 0, halve interval; guaranteed convergence, O(log₂(1/ε)) evaluations, no derivative needed.\nNewton-Raphson: x_{n+1} = x_n − f(x_n)/f\'(x_n); quadratic convergence near x* if f\'(x*) ≠ 0; diverges for poor initial guess or near-zero derivative.\nSecant method: approximate f\'(x_n) ≈ [f(x_n)−f(x_{n-1})]/(x_n−x_{n-1}); superlinear convergence (order 1.618), no explicit derivative.\nBrent\'s method: combine bisection + secant + inverse quadratic interpolation; guaranteed to converge (like bisection) with near-quadratic speed in practice — de facto standard.\nFixed-point iteration x_{n+1} = g(x_n): converges if |g\'(x*)| < 1 (contraction); diverges if |g\'| > 1; choose g to satisfy contraction.\nSystems of equations: Newton\'s method with Jacobian J, x_{n+1} = x_n − J⁻¹f(x_n); Broyden\'s method as quasi-Newton secant generalization.',
  },
  interpolation_methods: {
    summary: 'Construct a function passing through given data points for evaluation at new locations.',
    explanation: 'Lagrange interpolation: unique degree-n polynomial through n+1 points; L(x) = Σ y_i ∏_{j≠i} (x−x_j)/(x_i−x_j); O(n²) evaluation.\nNewton divided differences: triangular scheme for incremental addition of points; same polynomial as Lagrange, better numerics.\nRunge phenomenon: high-degree polynomial through equally-spaced points oscillates wildly near endpoints; mitigate with Chebyshev nodes x_k = cos(kπ/n).\nCubic spline: piecewise cubic on each interval with C² continuity; natural (zero second derivative at endpoints), clamped (prescribed slope), not-a-knot conditions.\nB-splines: local support, numerically stable, built on de Boor recursion; NURBS (non-uniform rational) in CAD; degree-k B-spline spans k+1 knot intervals.\nRBF (Radial Basis Functions): s(x) = Σ λ_i φ(||x−x_i||); for scattered multivariate data; thin-plate splines, multiquadrics; solve n×n linear system for weights.',
  },
  numerical_differentiation: {
    summary: 'Approximate derivatives of functions using finite differences or exact methods like automatic differentiation.',
    explanation: 'Forward difference: f\'(x) ≈ [f(x+h)−f(x)]/h; error O(h) truncation + O(ε_mach/h) rounding; optimal h ≈ √ε_mach ≈ 1e-8.\nCentral difference: [f(x+h)−f(x−h)]/(2h); error O(h²); second derivative (f(x+h)−2f(x)+f(x−h))/h²; optimal h ≈ ε_mach^{1/3}.\nComplex-step derivative: Im[f(x+ih)]/h; no subtraction cancellation, accurate to machine precision for any h; works for analytic f extended to complex plane.\nRichardson extrapolation: use D(h) and D(h/2) to cancel leading error term → D̃ = (4D(h/2)−D(h))/3; O(h^4) from O(h²) base.\nForward-mode AD: propagate dual numbers (x + x\'ε) through f; exact derivative in one pass; cost ≈ 1× original computation.\nReverse-mode AD (backpropagation): compute ∂f/∂x_i for all inputs in one backward pass; cost ≈ 4× forward; foundation of deep learning frameworks.',
  },
  stiff_ode_methods: {
    summary: 'Specialized ODE solvers for stiff systems where explicit methods require impractically small time steps for stability.',
    explanation: 'Stiffness: system with eigenvalue ratio |λ_max/λ_min| ≫ 1; explicit RK requires Δt ≤ O(1/|λ_max|) for stability while solution varies on 1/|λ_min| scale.\nImplicit Euler: y_{n+1} = y_n + h f(t_{n+1}, y_{n+1}); 1st order, L-stable (dissipates fast components); requires Newton solve per step.\nBDF (Backward Differentiation Formula, Gear\'s method): multistep implicit, orders 1-6; BDF-2: (3/2)y_{n+1} − 2y_n + (1/2)y_{n-1} = h f_{n+1}; zero-stable up to order 6.\nRadau IIA: implicit RK, A-stable and L-stable, 5th order (3-stage); excellent for DAEs and very stiff systems.\nSDIRK (Singly Diagonal Implicit RK): all diagonal Butcher elements equal σ → one LU factorization reused across stages; balance stability + efficiency.\nImplementations: MATLAB ode15s (BDF/NDF), scipy.integrate.solve_ivp(method=\'Radau\'), SUNDIALS CVODE/IDA, DifferentialEquations.jl.',
  },
  boundary_value_problems: {
    summary: 'Solve ODEs with conditions imposed at both endpoints of the domain rather than all conditions at a single initial point.',
    explanation: 'BVP: y\'\' = f(x, y, y\') with y(a) = α, y(b) = β (two-point); more generally, mixed/nonlinear boundary conditions and higher-order systems.\nShooting method: guess y\'(a), solve IVP, adjust guess via Newton\'s method until y(b) = β; works well for weakly nonlinear or well-posed problems.\nFinite difference discretization: replace derivatives, obtain (possibly nonlinear) system; for linear BVP, tridiagonal system solved in O(n).\nCollocation: represent y as linear combination of polynomials, enforce ODE exactly at collocation nodes (Gauss or Gauss-Lobatto points); high accuracy for smooth solutions.\nMATLAB bvp4c/bvp5c: collocation methods with adaptive mesh; scipy.integrate.solve_bvp: similar API; Chebfun (MATLAB): spectral collocation on adaptive grid.\nSturm-Liouville eigenvalue BVPs: −(p(x)y\')\'+ q(x)y = λ w(x)y; orthogonal eigenfunctions; applications in quantum mechanics, vibrations.',
  },
  error_analysis_numerical: {
    summary: 'Quantify and bound the errors arising in numerical computation from discretization and finite-precision arithmetic.',
    explanation: 'Sources of error: truncation (from discretization/approximation), rounding (from finite-precision floating-point), input data errors, and their propagation through computation.\nForward error analysis: bound |f̃(x) − f(x)| directly; can be pessimistic for long computations.\nBackward error: smallest Δx such that f̃(x) = f(x+Δx) exactly; backward-stable algorithm has backward error ≈ machine epsilon × ||x||.\nCondition number κ(f, x) = |x f\'(x) / f(x)|; for linear systems κ(A) = ||A||·||A⁻¹|| = σ_max/σ_min (spectral norm).\nRelative solution error ≤ κ(A) × relative data error; ill-conditioned (κ ≫ 1) systems amplify perturbations — loss of log₁₀(κ) decimal digits.\nNormal equations A^T Ax = A^T b have condition number κ(A^T A) = κ(A)²; use QR or SVD for least squares to avoid squaring condition number.',
  },
  multigrid_methods: {
    summary: 'Solve large linear systems arising from PDE discretization in O(N) work by combining coarse- and fine-grid computations.',
    explanation: 'Key insight: relaxation (Gauss-Seidel, Jacobi) efficiently eliminates high-frequency (oscillatory) errors but stalls on low-frequency (smooth) components.\nSmoothing: apply ν₁ pre-smoothing steps on fine grid to damp high-frequency error components.\nRestriction (R): transfer residual r = b − Ax from fine grid to coarser grid (factor-2 coarsening); full weighting or injection operators.\nCoarse-grid correction: solve A_H e_H = R r exactly (or recursively); prolongation (P = R^T): interpolate correction back to fine grid and update x.\nV-cycle: one coarse grid visit; W-cycle: two; F-cycle: combines both; Full MultiGrid (FMG) uses nested iteration for best constant factor.\nAlgebraic Multigrid (AMG): derive coarsening from matrix graph without explicit grid; handles unstructured meshes; HYPRE BoomerAMG, ML (Trilinos), PyAMG.',
  },
  fast_fourier_transform_algo: {
    summary: 'Compute the Discrete Fourier Transform in O(N log N) via divide-and-conquer, enabling fast spectral analysis and convolution.',
    explanation: 'DFT: X[k] = Σ_{n=0}^{N-1} x[n] W_N^{nk} where W_N = e^{−j2π/N}; naive O(N²) cost prohibitive for large N.\nCooley-Tukey radix-2 FFT: split N-point DFT into two N/2-point DFTs (even/odd indices) via butterfly; T(N) = 2T(N/2) + O(N) → O(N log₂N).\nBit-reversal permutation: reorder input before in-place butterfly stages; N must be power of 2 for radix-2, else use mixed-radix (radix-4, split-radix).\nBluestein\'s algorithm (chirp-Z): O(N log N) for any N using convolution; Rader\'s: prime N reduced to convolution.\nFFTW (Fastest Fourier Transform in the West): plans optimal algorithm for given N and hardware via SIMD; rigorously benchmarks all factorizations.\nApplications: fast convolution f*g ↔ F·G (O(N log N) vs O(N²)); polynomial multiplication; audio DSP; spectral methods for PDE.',
  },
  sparse_matrix_methods: {
    summary: 'Efficient storage formats and operations for matrices with mostly zero entries, exploiting sparsity for memory and computational savings.',
    explanation: 'CSR (Compressed Sparse Row): three arrays — val[] (non-zeros), col_ind[] (column indices), row_ptr[] (row start offsets); O(nnz) storage.\nCSC (Compressed Sparse Column): transpose of CSR, preferred for column operations; COO (triplet): (row, col, val) triples, easy to construct.\nSpMV (sparse matrix-vector multiply): y = Ax in O(nnz) operations — core kernel for iterative solvers, PageRank, GCN inference.\nFill-in during factorization: LU/Cholesky of sparse matrix generates non-zeros not in original sparsity pattern; fill-reducing orderings minimize this.\nAMD (Approximate Minimum Degree) ordering for symmetric, COLAMD for unsymmetric; METIS graph partitioning for parallel solvers.\nLibraries: scipy.sparse (Python), Intel MKL, cuSPARSE (NVIDIA GPU), PETSc, Trilinos; CSB format for cache-friendly parallel SpMV.',
  },
  condition_number: {
    summary: 'The condition number measures how much the solution to Ax = b can amplify perturbations in the data, indicating numerical stability.',
    explanation: 'Spectral condition number: κ₂(A) = ||A||₂ ||A⁻¹||₂ = σ_max / σ_min (ratio of largest to smallest singular values).\nFor Ax = b: relative error ||δx||/||x|| ≤ κ(A) · (||δA||/||A|| + ||δb||/||b||); solution can be inaccurate by factor κ even for small data perturbations.\nIll-conditioned matrix: κ ≫ 1; every doubling of κ loses one bit of precision in the solution; κ ≈ 10^d means d digits lost.\nNormal equations A^T A for least squares min ||Ax−b||: κ(A^T A) = κ(A)²; use QR or SVD decomposition of A directly to preserve conditioning.\nPreconditioning: replace Ax = b with M⁻¹Ax = M⁻¹b; choose M ≈ A so κ(M⁻¹A) ≪ κ(A); key in iterative solvers (CG, GMRES).\nPseudo-inverse A⁺ = VΣ⁺U^T (zero out small singular values) for rank-deficient or near-singular A; effective rank via numerical threshold.',
  },

// ── Advanced Mathematics ─────────────────────────────────────

  differential_geometry: {
    summary: 'Study smooth manifolds equipped with geometric structures such as metrics and connections, enabling calculus on curved spaces.',
    explanation: 'Smooth manifold M of dimension n: topological space covered by coordinate charts (U_α, φ_α) with smooth transition maps; tangent space T_pM at each point p.\nRiemannian metric g = g_{ij} dx^i dx^j: inner product on each tangent space, defines lengths ||v||² = g_{ij}v^i v^j, angles, and volumes.\nCovariant derivative ∇: generalize directional derivative to curved spaces; Levi-Civita connection is torsion-free and metric-compatible.\nGeodesics: length-minimizing curves satisfying ∇_{γ̇} γ̇ = 0 (parallel transport of tangent vector); great circles on S².\nCurvature: Riemann tensor R^i_{jkl} measures path-dependence of parallel transport; Ricci tensor R_{jl} = R^i_{jil}; scalar curvature R = g^{jl}R_{jl}.\nApplications: general relativity (G_{μν} = 8πT_{μν}), gauge field theory, geometric deep learning (equivariant networks on manifolds), robotics (SO(3) control).',
  },
  algebraic_topology_basics: {
    summary: 'Assign algebraic invariants (groups, rings) to topological spaces to classify them up to continuous deformation.',
    explanation: 'Homotopy equivalence: two spaces are equivalent if continuously deformable into each other; fundamental group π₁(X, x₀) classifies loops modulo homotopy.\nSimplicial homology: decompose space into simplices; boundary map ∂_n: C_n → C_{n−1}; homology H_n = ker(∂_n)/im(∂_{n+1}) counts n-dimensional holes.\nBetti numbers β_n = rank(H_n): β₀ = connected components, β₁ = tunnels, β₂ = voids; Euler characteristic χ = Σ(−1)^n β_n.\nCohomology: dual to homology, supports cup product giving ring structure; de Rham cohomology links topology to differential forms.\nPersistent homology (TDA): filter simplicial complex by parameter ε; track birth/death of topological features → persistence diagram/barcode.\nApplications: topological data analysis (TDA), protein structure, brain connectivity networks, coverage in sensor networks.',
  },
  measure_theory_basics: {
    summary: 'Rigorous framework for integration and probability based on measure spaces, extending Riemann integration to more general settings.',
    explanation: 'σ-algebra F on Ω: collection closed under complement and countable unions; (Ω, F) is measurable space; measure μ: F → [0,∞] countably additive.\nLebesgue measure on ℝ: assigns length to intervals, extends to Borel sets; Lebesgue-integrable functions broader class than Riemann-integrable.\nLebesgue integral: ∫f dμ = sup{∫φ dμ: φ ≤ f simple function}; handles functions with many discontinuities; agrees with Riemann for nice functions.\nKey theorems: Dominated Convergence (interchange limit and integral), Monotone Convergence, Fubini (iterated integrals), Tonelli.\nRadon-Nikodym theorem: if μ ≪ ν (μ absolutely continuous w.r.t. ν), then μ(A) = ∫_A f dν for unique f = dμ/dν (density/likelihood ratio).\nProbability theory as measure theory: probability space (Ω, F, P), random variable = measurable function, expectation = integral; enables rigorous treatment of conditioning.',
  },
  functional_analysis_basics: {
    summary: 'Study infinite-dimensional vector spaces of functions and operators between them, unifying quantum mechanics, PDE theory, and signal processing.',
    explanation: 'Normed space: vector space with ||·||; Banach space: complete normed space (all Cauchy sequences converge); Hilbert space: Banach with inner product ⟨·,·⟩.\nBounded linear operators: T: X→Y with ||T|| = sup_{||x||=1}||Tx|| < ∞; compact operators generalize finite-rank maps; closed graph theorem.\nSpectral theorem: self-adjoint operator A = A* on Hilbert space has real spectrum; orthonormal eigenbasis expansion u = Σ ⟨u,e_k⟩ e_k.\nFourier series: {e_k = e^{ikx}/√(2π)} forms orthonormal basis of L²[0,2π]; Parseval: ||f||² = Σ|f̂_k|².\nHahn-Banach theorem: extend bounded functional from subspace to whole space; implies existence of dual space; open mapping and closed graph theorems for surjective operators.\nApplications: quantum mechanics (observables as self-adjoint operators on L²(ℝ³)), Sobolev spaces for PDE, reproducing kernel Hilbert spaces (SVMs, GPs).',
  },
  complex_analysis: {
    summary: 'Calculus of complex-valued functions, where differentiability (analyticity) implies extraordinary regularity and global structure.',
    explanation: 'Holomorphic (analytic) function f = u + iv: satisfies Cauchy-Riemann equations ∂u/∂x = ∂v/∂y, ∂u/∂y = −∂v/∂x; infinitely differentiable as consequence.\nCauchy integral formula: f(z₀) = (1/2πi) ∮_C f(z)/(z−z₀)dz for z₀ inside C; determines all derivatives from boundary values.\nLaurent series: f(z) = Σ a_n(z−z₀)^n; poles (finite principal part), essential singularities (infinite); residue Res(f,z₀) = a_{−1}.\nResidue theorem: ∮_C f dz = 2πi Σ Res(f,z_k); transforms contour integrals to algebraic sums — evaluates difficult real integrals.\nConformal maps: angle-preserving bijections between domains; Möbius transformations z ↦ (az+b)/(cz+d); Riemann mapping theorem: any simply connected domain ≅ unit disk.\nApplications: fluid dynamics (stream function = imaginary part of complex potential), 2D electrostatics, z-transform for discrete signals, analytic continuation in number theory.',
  },
  abstract_algebra: {
    summary: 'Study algebraic structures — groups, rings, fields — defined by axioms, revealing deep symmetry across mathematics and applications.',
    explanation: 'Group (G, ·): closure, associativity, identity e, inverses; abelian if also commutative. Subgroups, cosets, Lagrange\'s theorem: |H| divides |G|.\nHomomorphism φ: G→H preserving structure; isomorphism: bijective homomorphism; first isomorphism theorem G/ker(φ) ≅ im(φ).\nRing (R, +, ·): abelian group under +, monoid under ×, distributivity; commutative ring if × commutes; ideal I: rI ⊆ I for all r.\nField: commutative ring where every nonzero element has multiplicative inverse; ℚ, ℝ, ℂ, GF(p) = ℤ/pℤ, GF(2^n).\nGalois theory: field extensions F⊂K correspond to Galois groups Gal(K/F); solvability of polynomial by radicals ↔ solvable Galois group.\nApplications: crystallographic space groups (symmetry), error-correcting codes over GF(2^n), RSA and ECC over finite fields, representation theory in physics.',
  },
  real_analysis_fundamentals: {
    summary: 'Rigorous foundations of calculus on ℝ, establishing the theoretical basis for convergence, continuity, and differentiability.',
    explanation: 'Completeness of ℝ: every Cauchy sequence converges; equivalent to least upper bound property; distinguishes ℝ from ℚ.\nBolzano-Weierstrass: every bounded sequence in ℝ^n has a convergent subsequence; implies compact sets are closed + bounded in ℝ^n.\nUniform continuity: ∀ε∃δ independent of x: |x−y|<δ → |f(x)−f(y)|<ε; continuous function on compact set is uniformly continuous.\nUniform convergence of f_n→f: interchange with limits, integrals, and (with bounded derivatives) derivatives; pointwise convergence insufficient.\nTaylor\'s theorem with Lagrange remainder: f(x) = Σ f^{(k)}(a)/k! (x−a)^k + R_n where R_n = f^{(n+1)}(ξ)/(n+1)! (x−a)^{n+1}.\nImplicit function theorem: F(x,y)=0 near (x₀,y₀) with ∂F/∂y ≠ 0 defines smooth y(x); inverse function theorem: local invertibility when Jacobian non-singular.',
  },
  number_theory_basics: {
    summary: 'Study of integers and their properties, underpinning modern cryptography and number-theoretic algorithms.',
    explanation: 'Fundamental theorem of arithmetic: every n > 1 factors uniquely into primes; prime counting π(n) ~ n/ln(n) (prime number theorem).\nEuclidean algorithm: gcd(a,b) = gcd(b, a mod b); runs in O(log min(a,b)) steps; extended Euclidean: find integers x,y with ax+by = gcd(a,b).\nModular arithmetic: a ≡ b (mod n) if n|(a−b); arithmetic ring ℤ/nℤ; Fermat\'s little: a^{p−1} ≡ 1 (mod p) for prime p, a not divisible by p.\nChinese Remainder Theorem (CRT): system x ≡ a_i (mod n_i) with coprime n_i has unique solution mod ∏n_i; used in RSA speedup and polynomial evaluation.\nQuadratic residues: a is QR mod p if ∃x: x² ≡ a (mod p); Legendre symbol (a/p) = a^{(p−1)/2} mod p; quadratic reciprocity theorem.\nApplications: RSA (Euler\'s theorem), ElGamal, Pohlig-Hellman, Miller-Rabin primality testing, AKS deterministic primality, lattice sieving for factoring.',
  },
  combinatorics_adv: {
    summary: 'Advanced counting techniques and structural results in combinatorics, with applications in analysis of algorithms and complexity.',
    explanation: 'Generating functions: A(x) = Σ a_n x^n; multiply/compose to solve recurrences; coefficient extraction via Cauchy integral or partial fractions.\nExponential generating functions: Σ a_n x^n/n! for labeled structures; e.g., EGF for permutations is 1/(1−x); useful for set partitions, trees.\nPólya enumeration: count colorings of structure under symmetry group G; apply Burnside\'s lemma then Pólya formula via cycle index polynomial.\nRamsey theory: R(r,s): any 2-coloring of complete graph K_N contains red K_r or blue K_s for large enough N; R(3,3)=6, exact values largely unknown.\nProbabilistic method (Erdős): show random object has desired property with positive probability → existence proof without construction.\nCatalan numbers C_n = (1/(n+1))C(2n,n): count Dyck paths, triangulations of polygon, full binary trees, valid bracket sequences; generating function C(x) = (1−√(1−4x))/(2x).',
  },
  stochastic_processes_adv: {
    summary: 'Mathematical models for systems evolving randomly over time, from Markov chains to continuous-time diffusion processes.',
    explanation: 'Markov chain: P(X_{t+1} = j | X_t = i, X_{t-1},...) = p_{ij}; transition matrix P; stationary distribution π satisfies πP = π.\nMixing time: steps until chain is close to stationarity; spectral gap (1−λ₂) controls mixing for reversible chains.\nBrownian motion W(t): W(0)=0, W(t)−W(s) ~ N(0,t−s) for s<t, independent increments, continuous paths, nowhere differentiable.\nItô calculus: stochastic integral ∫H dW; Itô\'s lemma: df(W,t) = (∂f/∂t + ½∂²f/∂W²)dt + ∂f/∂W dW — essential for deriving SDEs.\nOrnstein-Uhlenbeck process: dX = −θX dt + σ dW; mean-reverting, stationary distribution N(0, σ²/2θ); model for interest rates, velocity.\nApplications: financial derivatives (Black-Scholes SDE dS = μS dt + σS dW), particle physics (Langevin equation), diffusion probabilistic models in generative AI.',
  },
  random_matrix_theory: {
    summary: 'Study the statistical properties of eigenvalue distributions of large random matrices, with striking universal behavior.',
    explanation: 'GUE (Gaussian Unitary Ensemble): Hermitian matrices H_{ij} ~ CN(0,1); eigenvalue joint density ∝ ∏_{i<j}|λ_i−λ_j|² exp(−Σλ_i²/2).\nWigner semicircle law: empirical spectral distribution of n×n GUE converges as n→∞ to semicircle on [−2,2] with density √(4−x²)/(2π).\nMarchenko-Pastur law: for Wishart matrix W = (1/n)X^T X where X is p×n i.i.d. entries, empirical eigenvalue distribution converges as n,p→∞ with p/n→γ.\nEigenvalue spacing: level repulsion — unlike Poisson process, eigenvalues of GUE avoid each other; GUE spacing distribution = Wigner surmise P(s) ~ s e^{−s²}.\nCircular law: eigenvalues of n×n matrix with i.i.d. mean-0 variance-1/n entries converge to uniform distribution on unit disk.\nApplications: wireless communications (MIMO capacity), neural network weight matrices (random initialization and feature learning), financial correlation matrices.',
  },
  fourier_analysis_adv: {
    summary: 'Advanced Fourier analysis including transforms on ℝ, tempered distributions, and their applications to PDE and signal processing.',
    explanation: 'Fourier transform: f̂(ξ) = ∫_{−∞}^{∞} f(x) e^{−2πiξx} dx; inverse: f(x) = ∫ f̂(ξ) e^{2πiξx} dξ; Plancherel: ||f||_{L²} = ||f̂||_{L²}.\nConvolution theorem: (f*g)^(ξ) = f̂(ξ)·ĝ(ξ); multiplication theorem (f·g)^ = f̂*ĝ; unifies linear filtering with spectral multiplication.\nUncertainty principle: Δx·Δξ ≥ 1/(4π) where Δx = ||xf||/||f||, Δf = ||ξf̂||/||f̂||; Gaussian achieves equality (minimum uncertainty state in QM).\nPoisson summation formula: Σ_{n∈ℤ} f(n) = Σ_{k∈ℤ} f̂(k); bridges discrete and continuous analysis; proves modular forms symmetries.\nTempered distributions S\'(ℝ): extend Fourier to Dirac δ, step functions, polynomials; δ̂ = 1, (δ\')^ = 2πiξ; PDE solved in distribution sense.\nDecay of Fourier coefficients: if f ∈ C^k then |f̂(n)| = O(|n|^{−k}); analytic functions have exponential decay; governs approximation rate.',
  },
  wavelet_theory_math: {
    summary: 'Wavelet theory provides a multiresolution analysis framework for decomposing functions into localized frequency components.',
    explanation: 'Multiresolution analysis (MRA): nested closed subspaces ··· V_{−1} ⊂ V_0 ⊂ V_1 ⊂ ··· ⊂ L²(ℝ); ∪V_j dense, ∩V_j = {0}; scaling by 2 maps V_j to V_{j+1}.\nScaling function φ satisfies two-scale relation: φ(t) = √2 Σ_k h_k φ(2t−k); {φ(t−k)} orthonormal basis of V_0; coefficients h_k are lowpass filter.\nWavelet ψ generates complement subspace W_j: V_{j+1} = V_j ⊕ W_j; ψ(t) = √2 Σ_k g_k φ(2t−k) where g_k = (−1)^k h_{1−k} (highpass QMF).\nDWT (Discrete Wavelet Transform): apply h and g filters, downsample by 2; O(n) complexity; perfect reconstruction via synthesis filterbank.\nAdmissibility condition: ∫ψ dt = 0 (zero mean); implies ψ oscillates; also integrability and decay conditions for CWT.\nFrame theory: overcomplete dictionary {ψ_λ}; frame bounds A||f||² ≤ Σ|⟨f,ψ_λ⟩|² ≤ B||f||²; tight frames generalize orthonormal bases; applications in signal recovery.',
  },
  compressive_sensing_math: {
    summary: 'Acquire signals far below Nyquist rate by exploiting sparsity, with provable exact recovery via convex optimization.',
    explanation: 'Signal x ∈ ℝ^n is s-sparse: at most s nonzero entries; observe y = Φx ∈ ℝ^m with m ≪ n (underdetermined system).\nRIP (Restricted Isometry Property): (1−δ_s)||x||² ≤ ||Φx||² ≤ (1+δ_s)||x||² for all s-sparse x; ensures near-isometry for sparse vectors.\nGaussian/Bernoulli measurement matrices satisfy RIP with high probability if m ≥ C s log(n/s); optimal (order-optimal) measurement bound.\nBasis pursuit / L1 minimization: min ||x||₁ s.t. Φx = y recovers s-sparse x exactly if δ_{2s} < √2−1; LASSO adds noise term with λ regularization.\nGreedy algorithms: OMP (Orthogonal Matching Pursuit): iteratively select atom most correlated with residual; IHT (Iterative Hard Thresholding): gradient + threshold.\nDonoho-Tanner phase transition: sharp boundary in (m/n, s/m) plane separating exact recovery from failure; connections to statistical physics (replica method).',
  },

// ── Optimization Advanced ────────────────────────────────────

  linear_programming_simplex: {
    summary: 'Linear programming optimizes a linear objective over a convex polyhedron defined by linear constraints, solved efficiently by the simplex or interior point methods.',
    explanation: 'Standard form: min c^T x s.t. Ax = b, x ≥ 0; equivalent to any LP by adding slack variables; feasible region is convex polyhedron with finite vertices.\nSimplex method: move along edges of polyhedron to adjacent vertices improving objective; pivoting rule selects entering variable; Bland\'s rule prevents cycling.\nPhase I: find initial BFS by minimizing sum of artificial variables; Phase II: optimize original objective from feasible starting point.\nInterior point methods (Karmarkar 1984, path-following): polynomial O(n^{3.5} L) time; outperform simplex for very large LPs in practice.\nDuality: dual LP min b^T y s.t. A^T y = c, y ≥ 0; strong duality: primal optimal = dual optimal (when both feasible); complementary slackness conditions.\nSensitivity analysis: how do optimal value and solution change with c, b, A? Shadow prices (dual variables) = marginal cost of relaxing constraints.',
  },
  integer_programming: {
    summary: 'Optimization with integer-valued variables, capturing discrete decision-making; solved by branch-and-bound and cutting plane methods.',
    explanation: 'MIP (Mixed Integer Programming): some variables restricted to ℤ; binary (0-1) IP for decision variables; NP-hard in general but many practical instances tractable.\nBranch-and-bound: solve LP relaxation (remove integrality); if solution fractional, branch on x_i: add x_i ≤ ⌊x*_i⌋ and x_i ≥ ⌈x*_i⌉; prune by bounds.\nGomory cuts: derive valid inequalities from LP tableau that cut off fractional optimal; systematic generation of cutting planes from fractional solutions.\nBranch-and-cut: interleave branching with cutting planes (Gomory, knapsack cover, flow covers); state-of-the-art MIP solvers (Gurobi, CPLEX, SCIP).\nTotally unimodular (TU) matrices: every square submatrix has determinant 0,±1; LP relaxation automatically has integer optimal; network matrices are TU.\nApplications: scheduling (machine, crew), vehicle routing, facility location, portfolio optimization, gene prediction, VLSI layout.',
  },
  convex_optimization_adv: {
    summary: 'Convex optimization provides globally optimal solutions with efficient algorithms and principled duality theory.',
    explanation: 'Convex set C: λx+(1−λ)y ∈ C for x,y ∈ C, λ ∈ [0,1]; convex function f: f(λx+(1−λ)y) ≤ λf(x)+(1−λ)f(y); local = global optimum.\nKKT (Karush-Kuhn-Tucker) conditions: necessary and sufficient for convex problems; stationarity ∇f + Σλ_i∇g_i = 0, primal feasibility, dual feasibility λ_i≥0, complementary slackness λ_i g_i=0.\nLagrangian: L(x,λ,ν) = f(x) + λ^T g(x) + ν^T h(x); dual function g(λ,ν) = inf_x L(x,λ,ν); always concave; weak duality: g(λ,ν) ≤ p*.\nStrong duality via Slater\'s condition: ∃x s.t. g_i(x) < 0 (strict feasibility) → duality gap = 0; fundamental for many algorithmic analyses.\nADMM (Alternating Direction Method of Multipliers): split x = (u,v); minimize augmented Lagrangian alternately; excellent for distributed and consensus problems.\nDisciplined convex programming: CVXPY/CVX recognize problem structure → select appropriate solver (LP, SOCP, SDP, GP) automatically.',
  },
  semidefinite_programming: {
    summary: 'Semidefinite programming generalizes linear programming to matrix variables constrained to be positive semidefinite, enabling powerful relaxations.',
    explanation: 'SDP primal: minimize ⟨C,X⟩ = tr(CX) subject to tr(A_i X) = b_i, X ≽ 0 (positive semidefinite); X ∈ S^n; polynomial-time solvable.\nInterior point algorithms (primal-dual path-following): O(√n log(1/ε)) iterations, each O(n^6) worst-case; practical solvers: SeDuMi, SDPT3, Mosek.\nGoemans-Williamson MAX-CUT: SDP relaxation of {±1} quadratic form; round by random hyperplane → 0.878-approximation (best known assuming Unique Games).\nLMI (Linear Matrix Inequality) problems: a_0 + Σ x_i a_i ≽ 0; control design — Lyapunov stability, H∞ synthesis, structural optimization.\nSum of Squares (SOS): polynomial p(x) = Σ q_i(x)² ≥ 0; verify via SDP; DSOS/SDSOS for scalability; hierarchy of relaxations (Lasserre hierarchy).\nApplications: combinatorial optimization relaxations, matrix completion (nuclear norm), robust control (LMI constraints), quantum information.',
  },
  stochastic_optimization: {
    summary: 'Optimize objectives involving randomness, using stochastic gradient methods and variance reduction for large-scale machine learning.',
    explanation: 'Problem: minimize f(x) = E_ξ[F(x,ξ)]; sample gradient ∇F(x,ξ_t) as unbiased estimate of ∇f(x); SGD update x_{t+1} = x_t − α_t ∇F(x_t, ξ_t).\nConvergence: SGD achieves O(1/√T) rate for convex (optimal for stochastic first-order), O(1/T) for strongly convex with decaying α_t.\nVariance reduction (SVRG): periodically compute full gradient; update ĝ = ∇F(x,ξ) − ∇F(x̃,ξ) + ∇f(x̃); linear convergence for smooth strongly convex.\nAdaptive methods: AdaGrad (divide by accumulated gradient norm), RMSProp (exponential moving average), Adam (first + second moment estimates with bias correction).\nSAA (Sample Average Approximation): replace expectation by empirical average over N samples → solve deterministic approximation; convergence rate O(1/√N) for SAA optimum.\nTwo-stage stochastic programming: first-stage decisions x before ξ realized, second-stage recourse y(ξ); L-shaped method (Benders decomposition).',
  },
  evolutionary_algorithms: {
    summary: 'Optimization methods inspired by biological evolution, using populations of candidate solutions and stochastic variation operators.',
    explanation: 'Genetic algorithms (GA): represent solutions as chromosomes; selection (fitness-proportional or tournament), single/two-point crossover, bit mutation; elitism preserves best.\nEvolution Strategies (ES): optimize continuous parameters; (μ,λ)-ES selects μ parents from λ offspring; self-adaptation of strategy parameters (σ).\nCMA-ES (Covariance Matrix Adaptation): maintain distribution N(m, σ²C); update mean m, step size σ, covariance matrix C from successful offspring; handles non-separable correlations; O(n²) per generation.\nNEAT (NeuroEvolution of Augmenting Topologies): evolve both neural network weights and topology; speciation prevents premature convergence; historical markings for crossover.\nDifferential Evolution (DE): generate trial vector by combining three random individuals x_r1 + F(x_r2 − x_r3); crossover with current; effective for continuous optimization.\nEvolution Strategies as policy gradients: ES gradient ∇E_ε[F(θ+ε)] ≈ (1/N)Σ F(θ+ε_i)ε_i/σ²; used in OpenAI ES for RL policy optimization.',
  },
  simulated_annealing: {
    summary: 'Probabilistic metaheuristic for global optimization that escapes local minima by accepting worse solutions with temperature-dependent probability.',
    explanation: 'Inspired by annealing in metallurgy: slowly cooling material to low-energy crystalline state. Accept move to neighbor s\' from s with P = min(1, e^{−(E(s\')−E(s))/T}).\nAnnealing schedule: T decreases from T_max → T_min; logarithmic (T_k = c/log(k)) guarantees convergence to global optimum but impractically slow.\nIn practice: geometric cooling T_{k+1} = αT_k (α ≈ 0.9–0.99); restart from best known solution; critical balance between exploration and exploitation.\nNeighborhood design is problem-specific: 2-opt for TSP (swap two edges), swap moves for scheduling, perturbation for continuous optimization.\nParallel tempering (replica exchange): run m replicas at temperatures T_1 < ... < T_m; periodically swap configurations via Metropolis criterion; improves mixing.\nQuantum annealing (D-Wave): quantum tunneling replaces thermal fluctuations; Ising model formulation; claimed advantages for specific combinatorial problems.',
  },
  multi_objective_opt: {
    summary: 'Optimize multiple conflicting objectives simultaneously, seeking the Pareto front of non-dominated trade-off solutions.',
    explanation: 'Solution x dominates y if x is no worse in all objectives and strictly better in at least one; Pareto front = all non-dominated solutions.\nNSGA-II (Non-dominated Sorting GA-II): fast non-dominated sort O(mN² log N), crowding distance for diversity; elitist combined parent+offspring selection.\nMOEA/D: decompose into N scalar subproblems via weight vectors; optimize each using neighborhood information; efficient for complex Pareto shapes.\nScalarization: weighted sum Σ w_i f_i traces convex hull of Pareto front only (misses non-convex parts); ε-constraint: optimize one objective, bound others.\nHypervolume indicator: volume of space dominated by approximation set and bounded by reference point; measures quality of Pareto front approximation.\nApplications: engineering design (weight vs strength), multi-task learning (loss tradeoff), drug design (efficacy vs toxicity), neural architecture search.',
  },
  robust_optimization: {
    summary: 'Design solutions that perform well under worst-case uncertainty within a defined uncertainty set, without assuming a specific probability distribution.',
    explanation: 'Robust counterpart: min_x max_{u∈U} f(x,u); replace uncertain parameter with its worst case over uncertainty set U; tractable when U has nice structure.\nBox uncertainty U = {u: |u_i| ≤ ρ_i}: robust LP remains LP with dualized constraints; conservative but tractable.\nEllipsoidal uncertainty U = {u: u^T Σ^{−1} u ≤ 1}: robust LP becomes SOCP; less conservative; appropriate when uncertainty is Gaussian-like.\nBertsimas-Sim Γ-robustness: at most Γ parameters deviate from nominal; polynomial LP reformulation; control conservatism via Γ ∈ [0, n].\nDistributionally Robust Optimization (DRO): uncertainty set P of distributions; min_x max_{P∈P} E_P[f(x,ξ)]; Wasserstein ball around empirical distribution.\nApplications: portfolio optimization (worst-case return), supply chain (demand uncertainty), ML regularization (Wasserstein DRO ≡ regularized ERM), power grid.',
  },
  combinatorial_opt: {
    summary: 'Optimize over discrete combinatorial structures; NP-hardness requires approximation algorithms, heuristics, or exact exponential methods.',
    explanation: 'TSP (Traveling Salesman Problem): find min-cost Hamiltonian cycle; NP-hard; Christofides algorithm: min spanning tree + T-join + Eulerian circuit → 3/2-approximation.\nLKH (Lin-Kernighan-Helsgott): powerful TSP heuristic using k-opt moves; solves million-city instances to near-optimality in practice.\nApproximation algorithms: guarantee ALG(I)/OPT(I) ≤ α for all inputs; vertex cover 2-approx (maximal matching), set cover ln(n)-approx (greedy).\nPTAS: polynomial-time approximation scheme; (1+ε)-approximation in poly(n) for fixed ε; knapsack has FPTAS (runs in poly(n, 1/ε)).\nFPT (Fixed-Parameter Tractable): algorithm O(f(k)·n^c) where k is problem parameter; vertex cover O(2^k n), FPT in k; W-hierarchy for likely-intractable params.\nExact methods: dynamic programming (Held-Karp O(2^n n²) for TSP), branch-and-bound (best known for IP), branch-and-price (column generation).',
  },
  network_flow_opt: {
    summary: 'Optimize flow through networks with capacitated edges, unifying transportation, assignment, and shortest-path problems.',
    explanation: 'Min-cost flow: find flow f: E→ℝ satisfying capacity 0 ≤ f_e ≤ u_e, conservation Σ_in f = Σ_out f at internal nodes, minimizing Σ c_e f_e.\nSuccessive shortest paths: augment flow along cheapest augmenting path (use Bellman-Ford for negative costs or Johnson\'s reweighting); O(n m log n) with Dijkstra.\nCycle-canceling: find negative-cost augmenting cycle in residual graph, send maximum flow around it; each iteration reduces cost.\nSpecial cases: max-flow (set costs to 0), transportation problem (bipartite source-sink), assignment problem (unit capacities) — all solvable as min-cost flow.\nHungarian algorithm: solve assignment problem in O(n³); equivalent to finding min-weight perfect matching in bipartite graph.\nTU property of network matrices: integer LP optimal automatically → optimal flow always integral for integer capacities and demands.',
  },
  dynamic_programming_opt: {
    summary: 'Solve optimization problems by breaking them into overlapping subproblems, storing results to avoid redundant computation.',
    explanation: 'Optimal substructure: optimal solution contains optimal solutions to subproblems; overlapping subproblems: same subproblem solved multiple times.\nBellman\'s principle: V(s) = max_a [r(s,a) + γV(s\')]; underpins RL (value function), shortest paths (Dijkstra/Bellman-Ford), sequence DP.\nTabulation (bottom-up): fill table in topological order; O(states × transitions) time and space; explicit state enumeration.\nMemoization (top-down): recurse with caching; same complexity; avoids computing unreachable states.\nClassic problems: 0/1 Knapsack O(nW), LCS O(mn), Edit Distance O(mn), Matrix Chain O(n³), Viterbi HMM O(N²T), Floyd-Warshall O(V³).\nAdvanced: bitmask DP for small sets O(2^n n), convex hull trick reduces O(n²) DP with linear cost to O(n log n), divide-and-conquer optimization for monotone decisions.',
  },
  approximation_algorithms: {
    summary: 'Polynomial-time algorithms for NP-hard problems with provable worst-case guarantees on solution quality.',
    explanation: 'Approximation ratio: for minimization min ALG(I)/OPT(I) = α ≥ 1; for maximization max OPT(I)/ALG(I) = α; poly-time α-approximation algorithm.\nGreedy vertex cover: pick edge (u,v) ∉ matching, add both endpoints, delete incident edges; 2-approximation; tight on complete bipartite graphs.\nGoemans-Williamson MAX-CUT (1995): SDP relaxation + random hyperplane rounding → 0.878·OPT; assuming Unique Games Conjecture, best possible.\nKnapsack FPTAS: scale and round item values, solve rounded DP in O(n²/ε); (1+ε)-approximation in O(n³/ε) time.\nPCP theorem (Arora-Safra-Lund-Motwani 1992): NP = PCP[O(log n), O(1)]; implies constant-factor hardness for many problems (e.g., set cover Ω(log n) unless P=NP).\nRandomized rounding: solve LP relaxation x*∈[0,1], independently round x_i = 1 with probability x*_i; analyze approximation ratio in expectation.',
  },
  online_algorithms: {
    summary: 'Algorithm design for sequential decision-making without knowledge of future inputs, measured by competitive ratio against offline optimum.',
    explanation: 'Competitive ratio: for minimization ALG(σ)/OPT(σ) ≤ ρ for all input sequences σ; for maximization OPT/ALG ≤ ρ; lower bound via adversary argument.\nSki rental: rent for 1/day or buy for B; break-even strategy: rent B days then buy → competitive ratio 2; randomized (Baeza-Yates-Rgozin): ratio e/(e−1) ≈ 1.58.\nPaging problem: maintain k-page cache; LRU (Least Recently Used) is k-competitive and optimal among deterministic algorithms; RAND achieves H_k-competitive.\nOnline bipartite matching: RANKING algorithm (randomly permute offline vertices, match to earliest available) achieves competitive ratio 1−1/e; optimal.\nSecretary problem: n candidates arrive in random order; see each candidate then irrevocably hire/skip; threshold strategy (skip first n/e, hire first better) → optimal 1/e success probability.\nAdversary models: oblivious (sequence fixed before algorithm runs), adaptive-online (sees algorithm\'s random choices), adaptive-offline (strongest).',
  },
  bilevel_programming: {
    summary: 'Two-level hierarchical optimization where the upper-level (leader) optimizes over the optimal response set of the lower-level (follower).',
    explanation: 'Formulation: min_{x,y} F(x,y) s.t. G(x,y) ≤ 0 and y ∈ argmin_{y} {f(x,y): g(x,y) ≤ 0}; inherently non-convex, NP-hard in general.\nKKT reformulation: replace lower-level by its KKT conditions → Mathematical Program with Equilibrium Constraints (MPEC); constraint qualifications often fail (LICQ).\nHyperparameter optimization: θ* = argmin_{θ} L_val(w*(θ)) where w*(θ) = argmin_w L_train(w,θ); solved by implicit differentiation: dw*/dθ via implicit function theorem.\nIFT (Implicit Function Theorem)-based gradient: ∂L_val/∂θ = −(∂²L_train/∂w²)⁻¹ ∂²L_train/∂w∂θ; approximate efficiently using Neumann series or conjugate gradient.\nStackelberg game: leader moves first, follower best-responds; bilevel captures sequential rationality; security games, network toll design, adversarial ML.\nApplications: meta-learning (MAML), neural architecture search, domain adaptation, pricing optimization, chemical process design.',
  },

// ── Statistics Advanced ──────────────────────────────────────

  bayesian_inference_adv: {
    summary: 'Advanced Bayesian methods for posterior computation and model comparison, scaling to complex hierarchical models.',
    explanation: 'Posterior p(θ|x) ∝ p(x|θ)p(θ); conjugate priors yield analytical posteriors: Beta-Binomial, Gamma-Poisson, Normal-Normal (known σ²).\nVariational inference (VI): approximate p(θ|x) with q(θ;λ) in tractable family by maximizing ELBO = E_q[log p(x,θ)] − E_q[log q(θ)]; mean-field VI (factored q).\nVAE (Variational Autoencoder): neural network parameterizes q(z|x) and p(x|z); reparameterization trick enables gradient through sampling.\nLaplace approximation: fit Gaussian to posterior at mode; q(θ) = N(θ̂, [−∇²log p(θ̂|x)]⁻¹); 2nd-order cheap but Gaussian may be poor.\nMCMC: HMC (Hamilton Monte Carlo) uses gradient to propose distant moves; NUTS (No-U-Turn Sampler) in Stan adapts step length automatically.\nBayesian model comparison: Bayes factor B_{12} = p(x|M₁)/p(x|M₂); marginal likelihood p(x|M) = ∫p(x|θ,M)p(θ|M)dθ penalizes complexity naturally.',
  },
  bootstrap_statistics: {
    summary: 'Estimate sampling distributions and confidence intervals by resampling from observed data, without assuming parametric forms.',
    explanation: 'Nonparametric bootstrap: draw B samples of size n with replacement from observed data {x₁,...,x_n}; compute θ̂*_b = T(x*_b) for each.\nBootstrap standard error: SE_boot = √(Σ(θ̂*_b − θ̄*)²/(B−1)); asymptotically valid for smooth statistics (mean, regression coefficients, correlation).\nBootstrap CI methods: percentile CI [θ*_{(α/2)}, θ*_{(1−α/2)}]; BCa (Bias-Corrected Accelerated) adjusts for bias and skewness of sampling distribution — more accurate.\nStudentized (pivot) bootstrap: normalize by bootstrap standard error; better coverage in heavy tails; parametric bootstrap: resample from fitted model.\nBlock bootstrap for dependent data: MBB (Moving Blocks), circular blocks, stationary bootstrap (random block length) — handles time series and spatial data.\nApplications: CI for AUC, median, quantile regression; hypothesis testing (permutation test); bias estimation for complex estimators; model averaging.',
  },
  causal_inference: {
    summary: 'Methods for estimating causal effects from observational data, distinguishing association from causation via structural assumptions.',
    explanation: 'Potential outcomes framework (Rubin): each unit i has Y_i(1) (treated) and Y_i(0) (control); ATE = E[Y(1)−Y(0)]; SUTVA: no interference between units.\nRCT identifies ATE: random assignment ensures independence Y(t) ⊥ T; observational data: confounders U affect both T and Y → biased estimate.\nPropensity score e(x) = P(T=1|X=x): balance covariates; IPW estimator: ATE = E[TY/e(X) − (1−T)Y/(1−e(X))]; doubly robust (AIPW) combines outcome model.\nIV (Instrumental Variables): instrument Z affects T but not Y directly; 2SLS estimator identifies LATE (Local ATE); valid IVs hard to find in practice.\nDAG (Pearl\'s do-calculus): encode causal assumptions in DAG; backdoor criterion identifies confounders to adjust for; front-door adjustment for unobserved confounders.\nQuasi-experiments: DiD (difference-in-differences) with parallel trends assumption; RDD (regression discontinuity) at policy threshold; synthetic control for aggregate data.',
  },
  survival_analysis: {
    summary: 'Analyze time-to-event data with censoring, estimating hazard rates and comparing survival functions across groups.',
    explanation: 'Survival function S(t) = P(T > t); hazard rate h(t) = lim_{Δ→0} P(t ≤ T < t+Δ|T ≥ t)/Δ = f(t)/S(t); cumulative hazard H(t) = ∫₀ᵗ h(s)ds = −log S(t).\nRight censoring: event not observed before study end or dropout; C_i < T_i; observed = (min(T_i,C_i), I(T_i ≤ C_i)) pairs.\nKaplan-Meier estimator: Ŝ(t) = ∏_{t_i ≤ t} (1 − d_i/n_i) where d_i deaths, n_i at-risk at each event time; nonparametric, handles censoring.\nNelson-Aalen: Ĥ(t) = Σ_{t_i ≤ t} d_i/n_i; cumulative hazard estimate; more stable than 1−KM in small samples.\nCox proportional hazards: h(t|x) = h₀(t)·exp(β^T x); partial likelihood estimates β without specifying h₀(t); PH assumption tested via Schoenfeld residuals.\nLog-rank test: compare K survival curves under H₀: S₁=...=S_K; weight d_i: O(expected) − O(observed) normalized; also Wilcoxon (weights by n_i).',
  },
  time_series_statistics: {
    summary: 'Statistical analysis and modeling of temporally ordered data, including ARIMA models, spectral analysis, and volatility modeling.',
    explanation: 'Stationarity: constant mean μ, variance σ², and autocovariance γ(k) = Cov(X_t, X_{t+k}) depending only on lag k; necessary for many time series models.\nUnit root testing: ADF (Augmented Dickey-Fuller) test H₀: unit root (random walk); KPSS: H₀ stationarity; differencing d times achieves stationarity for ARIMA(p,d,q).\nARMA(p,q): X_t = Σ φ_i X_{t−i} + Σ θ_j ε_{t−j} + ε_t; ARIMA(p,d,q): d-differenced ARMA; Box-Jenkins: identify (ACF/PACF), estimate (MLE), diagnose (Ljung-Box).\nSeasonal ARIMA SARIMA(p,d,q)(P,D,Q)_s: seasonal differencing and seasonal AR/MA terms; model monthly/quarterly seasonality.\nGARCH(p,q): σ²_t = ω + Σα_i ε²_{t−i} + Σβ_j σ²_{t−j}; conditional heteroskedasticity for financial returns; EGARCH, GJR-GARCH for asymmetry (leverage effect).\nSpectral analysis: periodogram I(ω) = |Σ x_t e^{−iωt}|²/n; spectral density function; Lomb-Scargle for unevenly sampled astronomical/biological data.',
  },
  mixed_effects_models: {
    summary: 'Hierarchical regression models combining population-level fixed effects and subject-specific random effects for repeated/clustered data.',
    explanation: 'LMM: Y_{ij} = x_{ij}^T β + z_{ij}^T u_i + ε_{ij}; β: fixed effects (population parameters), u_i ~ N(0,D): random effects (subject deviations), ε ~ N(0,σ²I).\nMarginal model: Y_i ~ N(X_i β, Z_i D Z_i^T + σ²I); BLUP (Best Linear Unbiased Predictor): ũ_i = D Z_i^T V_i^{−1}(Y_i − X_i β̂); shrinkage toward population mean.\nREML (Restricted Maximum Likelihood): profile likelihood over β; unbiased variance component estimates; preferred over ML for variance estimation in small samples.\nCrossed vs nested random effects: schools/students (nested: student within school), stimulus/subject (crossed: each subject sees each stimulus).\nNonlinear mixed models (NLME): E[Y_ij|u_i] = f(x_{ij}, β+u_i); require numerical integration (Laplace, adaptive quadrature, MCMC).\nSoftware: lme4/nlme (R), MixedModels.jl (Julia), statsmodels.formula.MixedLM (Python); applications: clinical trials, educational data, longitudinal studies, A/B testing.',
  },
  nonparametric_tests: {
    summary: 'Hypothesis tests that make minimal distributional assumptions, relying on ranks or permutations instead of parametric models.',
    explanation: 'Wilcoxon rank-sum (Mann-Whitney U): test H₀: P(X>Y)=0.5 for two independent samples; rank combined sample, sum ranks of group 1; asymptotically normal.\nWilcoxon signed-rank: paired samples; compute D_i = X_i−Y_i, rank |D_i|, sum positive-rank ranks; more powerful than sign test for symmetric distributions.\nKruskal-Wallis: nonparametric analog of one-way ANOVA; rank all observations, compare mean ranks across k groups; H statistic chi-squared distributed.\nSpearman ρ: correlation of ranks r_Xi, r_Yi; Kendall τ: (concordant − discordant pairs)/(n choose 2); both measure monotone association.\nKolmogorov-Smirnov test: D = sup_x|F̂_n(x) − F₀(x)| for one-sample or |F̂_n(x) − Ĝ_m(x)| for two-sample; distribution-free under H₀.\nPermutation (randomization) test: compute statistic T observed; permute labels B times; p = #{T* ≥ T_obs}/B; exact p-value; powerful and flexible.',
  },
  multiple_testing_correction: {
    summary: 'Control error rates when performing many simultaneous hypothesis tests, balancing type I and type II errors.',
    explanation: 'FWER (Family-Wise Error Rate) = P(at least one false rejection); Bonferroni: reject p_i ≤ α/m; guarantees FWER ≤ α but very conservative for large m.\nHolm procedure (step-down): sort p_{(1)} ≤ ... ≤ p_{(m)}; reject p_{(i)} ≤ α/(m−i+1); uniformly more powerful than Bonferroni while controlling FWER.\nFDR (False Discovery Rate): E[V/R | R>0]·P(R>0) where V = false rejections, R = total rejections; less stringent than FWER, more power.\nBenjamini-Hochberg (BH) procedure: sort p-values, find largest k s.t. p_{(k)} ≤ kα/m; reject all p_{(1)},...,p_{(k)}; controls FDR ≤ α for independent tests.\nq-value: FDR analog of p-value; q(i) = min_{j≥i} (m·p_{(j)}/j)·π₀ where π₀ = proportion of true nulls; estimated from p-value histogram.\nApplications: GWAS (10⁶ SNPs → Bonferroni threshold 5×10⁻⁸), neuroimaging (voxelwise t-tests), RNA-seq differential expression, A/B test multiple metrics.',
  },
  dimensionality_reduction_stat: {
    summary: 'Reduce high-dimensional data to lower dimensions while preserving relevant structure for visualization and downstream analysis.',
    explanation: 'PCA: find directions of maximum variance; eigenvectors of sample covariance S = (1/n)X^T X; project onto top k eigenvectors; O(min(p,n)^2 max(p,n)) via SVD.\nKernel PCA: compute K_{ij} = k(x_i,x_j), center kernel matrix, eigen-decompose; captures nonlinear structure without explicit feature map.\nICA (Independent Component Analysis): find linear transform W such that Wx has statistically independent components; FastICA uses negentropy; for non-Gaussian sources.\nFactor Analysis: X = Λ f + ε; latent factors f ~N(0,I), loadings Λ, noise ε ~N(0,Ψ) diagonal; EM algorithm; interpretable factors in psychology, finance.\nMDS (Multidimensional Scaling): find low-dim embedding preserving pairwise distances; classical MDS via double-centering + eigen-decomposition = PCA for Euclidean distances.\nUMAP: construct weighted k-NN graph, optimize low-dim embedding to match fuzzy topological structure; O(n log n) vs O(n²) for t-SNE; preserves global structure better.',
  },
  structural_equation_model: {
    summary: 'Combine path analysis and factor analysis to model complex causal and measurement structures among observed and latent variables.',
    explanation: 'SEM = measurement model (CFA) + structural model; measurement: X = Λξ + δ, observed indicators X from latent ξ with error δ.\nStructural model: η = Bη + Γξ + ζ; endogenous latent η depends on exogenous latent ξ and each other; B (endogenous), Γ (exogenous) coefficient matrices.\nIdentification: model identified if each parameter uniquely determined from observed covariance matrix; necessary: df ≥ 0 (df = p(p+1)/2 − free parameters).\nEstimation: ML assuming multivariate normality; minimize discrepancy F(S,Σ(θ)); ADF (asymptotically distribution-free) for non-normal data.\nFit indices: CFI = 1 − (χ²_model/df_model)/(χ²_null/df_null) > 0.95; TLI > 0.95; RMSEA < 0.05 (close fit) < 0.08 (acceptable).\nExtensions: latent growth curve models (polynomial trajectories over time), mixture SEM (latent classes), Bayesian SEM; software: lavaan (R), Mplus, semopy (Python).',
  },
  copula_models: {
    summary: 'Copulas separate the marginal distributions from the dependence structure, enabling flexible multivariate modeling.',
    explanation: 'Sklar\'s theorem (1959): for any joint CDF H(x,y) with marginals F_X, F_Y, ∃ copula C s.t. H(x,y) = C(F_X(x), F_Y(y)); C unique if marginals continuous.\nGaussian copula: C(u,v;ρ) = Φ_ρ(Φ⁻¹(u), Φ⁻¹(v)); captures linear correlation; tail independence (unlike true joint normal).\nArchimedean copulas: C(u,v) = φ⁻¹(φ(u)+φ(v)) for generator φ; Clayton (lower tail dependence, θ≥0), Gumbel (upper tail dependence θ≥1), Frank (symmetric).\nTail dependence: upper λ_U = lim_{u→1} P(V>u|U>u); Gaussian copula has λ_U = 0 (tail independence) — criticized after 2008 financial crisis.\nVine copulas (pair copula constructions): decompose d-dimensional joint into d(d−1)/2 bivariate copulas; C-vine, D-vine; flexible high-dimensional dependence modeling.\nApplications: multivariate VaR/CVaR in finance, reliability engineering (component dependencies), hydrology (joint flood probability), survival analysis.',
  },
  extreme_value_stat: {
    summary: 'Statistical theory for the extremes of random variables, providing models for rare events like floods, financial crashes, and material failures.',
    explanation: 'Gnedenko (1943): maximum M_n = max(X_1,...,X_n) normalized converges in distribution to one of three types: Gumbel (light tail), Fréchet (heavy tail, power law), Weibull (bounded upper tail).\nGEV (Generalized Extreme Value): unifies all three types; G(x;μ,σ,ξ) = exp(−[1+ξ(x−μ)/σ]^{−1/ξ}); ξ=0 Gumbel, ξ>0 Fréchet, ξ<0 Weibull.\nBlock maxima method: divide data into blocks (years), fit GEV to annual maxima; parameter estimation via MLE or L-moments.\nPeaks over Threshold (POT): exceedances above high threshold u follow GPD H(x;σ,ξ) = 1−(1+ξx/σ)^{−1/ξ}; more efficient use of data than block maxima.\nReturn period T: T-year return level x_T = μ + σ(−log(1−1/T))^{−ξ}; 100-year flood = level exceeded with probability 1/100 per year.\nApplications: flood/wind design levels in civil engineering, reinsurance, VaR/Expected Shortfall, extreme temperature records, fatigue in materials.',
  },
  experimental_design: {
    summary: 'Systematically plan experiments to efficiently estimate the effects of factors on responses with minimum resources.',
    explanation: 'Full factorial 2^k design: k factors at two levels (low/high); 2^k runs estimate all main effects and interactions; effect = (high mean) − (low mean).\nFractional factorial 2^{k−p}: run 1/2^p fraction; alias structure: some effects confounded with others; resolution III (main effects ≠ interactions), IV (main ≠ 2-way), V.\nResponse Surface Methodology (RSM): model curvature with quadratic terms; Central Composite Design (CCD): factorial + star points + center; Box-Behnken: no corner points.\nD-optimality: choose design matrix X to maximize det(X^T X), minimizing variance of parameter estimates; computer-generated for non-standard constraints.\nLatin Hypercube Sampling (LHS): stratified random design ensuring each marginal uniform; popular for computer experiments and uncertainty quantification.\nAnalysis: ANOVA for factorial designs; regression for RSM; Taguchi methods: orthogonal arrays, signal-to-noise ratio for robust parameter design.',
  },
  probabilistic_graphical_models: {
    summary: 'Encode probabilistic independence structure compactly using graphs, enabling efficient inference and learning in high-dimensional distributions.',
    explanation: 'Bayesian network: DAG G = (V,E); joint P(x₁,...,x_n) = ∏_i P(x_i|pa(x_i)); d-separation in graph ↔ conditional independence in distribution.\nMarkov Random Field (undirected): Gibbs distribution P(x) ∝ exp(−Σ_c ψ_c(x_c)); factors over maximal cliques c; Ising model: binary pairwise MRF.\nVariable elimination: exact inference; marginalize variables one by one via factor product and summation; complexity exponential in tree-width.\nBelief propagation: message-passing algorithm; exact on trees (O(n) per query); loopy BP (LBP) on general graphs — approximate but effective in practice.\nEM algorithm for learning: E-step: compute expected sufficient statistics; M-step: maximize log-likelihood; for mixtures, HMMs, latent factor models.\nApplications: medical diagnosis (CPCS network), protein structure prediction, image segmentation (MRF), speech recognition (HMM), NLP (CRF for NER), recommendation systems.',
  },

// ── Advanced Cryptography ────────────────────────────────────

  elliptic_curve_crypto: {
    summary: 'Public-key cryptography based on the algebraic structure of elliptic curves over finite fields, offering strong security with small key sizes.',
    explanation: 'Elliptic curve over 𝔽_p: y² ≡ x³+ax+b (mod p) with 4a³+27b² ≢ 0; points + point at infinity O form abelian group under geometric addition law.\nPoint addition P+Q: slope λ=(y_Q−y_P)/(x_Q−x_P); R=−(P+Q): reflect over x-axis; point doubling uses tangent line; closed-form formulas, ~10 field operations.\nECDH: Alice computes aG, Bob computes bG (G base point of prime order n); shared secret = abG = baG; ECDLP: find a from G and aG — no sub-exponential algorithm known.\nECDSA: sign with (r,s) = ((kG)_x mod n, k⁻¹(H(m)+ar) mod n); verify using public key; nonce k must be unique and secret (Sony PS3 break reused k).\nSecurity comparison: 256-bit ECC ≈ 3072-bit RSA security (128-bit); 521-bit ECC ≈ 15360-bit RSA; orders of magnitude smaller keys and faster operations.\nStandardized curves: NIST P-256/384/521, Curve25519 (Montgomery form, constant-time, avoids side-channels), Ed25519 (twisted Edwards, signing), secp256k1 (Bitcoin).',
  },
  lattice_cryptography: {
    summary: 'Post-quantum cryptographic constructions based on hard lattice problems, conjectured to resist both classical and quantum attacks.',
    explanation: 'Lattice: set L = {Σ z_i b_i : z_i ∈ ℤ} for basis vectors b_i ∈ ℝⁿ; shortest vector problem (SVP): find shortest nonzero vector — NP-hard approximation for small factors.\nLWE (Learning With Errors, Regev 2005): given many (a_i, b_i = ⟨a_i,s⟩+e_i mod q) with small e_i, find s; reduction from worst-case SVP guarantees hardness.\nRLWE: work in polynomial ring ℤ_q[x]/(x^n+1); more efficient (O(n log n) multiply via NTT); basis of CRYSTALS-Kyber and Dilithium.\nKyber (NIST PQC standard 2022): ML-KEM (Module LWE KEM); security parameter levels 512/768/1024; 768-bit ≈ 128-bit security; small public keys ~1 KB.\nFalcon (NIST): NTRU-based signature using GPV hash-and-sign framework over NTRU lattices; very compact signatures; requires Gaussian sampler.\nNo known quantum speedup: Grover gives √ speedup for generic search but lattice algorithms need super-polynomial speedup to break — not provided by known quantum algorithms.',
  },
  zero_knowledge_proofs_adv: {
    summary: 'Cryptographic protocols allowing a prover to convince a verifier of a statement\'s truth without revealing any additional information.',
    explanation: 'Zero-knowledge property: transcript (P,V) interactions indistinguishable from simulator\'s output without witness; completeness + soundness + ZK.\nzk-SNARK (Succinct Non-Interactive Argument of Knowledge): O(1) proof size, O(1) verify time regardless of computation size; requires trusted setup (CRS).\nGroth16: pairing-based SNARK using bilinear groups; 3 group elements proof (192 bytes for BN254); most efficient per-constraint; circuit-specific CRS.\nPLONK: universal CRS (updatable SRS); polynomial commitments (KZG); any circuit without new CRS; widely deployed in Ethereum ecosystem.\nSTARKs: no trusted setup (FRI-based polynomial commitment from hash functions); O(log²n) proof size; quantum-safe; larger proofs than SNARKs but transparent.\nApplications: Zcash (private transactions using Groth16), Ethereum zkEVM (StarkNet uses STARKs, Polygon zkEVM uses PLONK), identity proofs, verifiable outsourcing.',
  },
  secure_mpc: {
    summary: 'Allow multiple parties to jointly compute a function over their private inputs without revealing those inputs to each other.',
    explanation: 'Security model: semi-honest (follows protocol, tries to learn from transcript) vs malicious (may deviate arbitrarily); information-theoretic vs computational security.\nShamir secret sharing: split secret s into n shares via random degree-(t) polynomial f with f(0)=s; any t+1 shares reconstruct s (Lagrange interpolation); t shares reveal nothing.\nGMW protocol: evaluate boolean circuit share-by-share; AND gates require OT (Oblivious Transfer); XOR gates free; O(depth) communication rounds.\nGarbled circuits (Yao): garbler encrypts each gate\'s truth table with wire labels; evaluator evaluates using OT to obtain input wire label; constant rounds, O(n) overhead.\nBeavers multiplication triples: offline phase generates (a,b,c) triples with c=ab; online phase uses triples for free multiplication share; SPDZ protocol.\nApplications: privacy-preserving ML training, private set intersection (PSI), threshold signing for blockchain wallets, private genome comparison, dark pool trading.',
  },
  post_quantum_algorithms: {
    summary: 'Cryptographic algorithms designed to resist attacks from quantum computers that break RSA and ECC via Shor\'s algorithm.',
    explanation: 'Shor\'s algorithm (1994): quantum phase estimation finds period of a^x mod N; factors n-bit number in O(n³) quantum gates + O(n) classical; breaks RSA, DH, ECC.\nNIST PQC standards (2024, FIPS): ML-KEM (CRYSTALS-Kyber) for key encapsulation, ML-DSA (CRYSTALS-Dilithium) and FN-DSA (FALCON) for digital signatures.\nSPHINCS+: stateless hash-based signature; security reduces to collision-resistance of hash function; slow signing (~20ms), large signatures (~8KB); most conservative.\nCode-based cryptography: McEliece (1978) based on decoding random linear codes (NP-hard); large public keys (~1MB); Classic McEliece in NIST competition.\nIsogeny-based: SIDH (Jao-De Feo 2011) — broken by Castryck-Decru attack (2022) using glue-and-split technique; remaining: SQISign (compact but slow).\nHybrid schemes: combine classical (X25519) + PQ (Kyber) in TLS handshake; provides security if either primitive secure; recommended migration strategy by NSA/NIST.',
  },
  verifiable_random_functions: {
    summary: 'A VRF provides a pseudorandom function whose output can be publicly verified to be correctly computed from a given secret key.',
    explanation: 'VRF definition: keyed pseudorandom function where output y = VRF_prove(SK, x) comes with proof π allowing anyone to verify y = VRF(PK, x) without learning SK.\nProperties: uniqueness (only one valid (y,π) per (SK,x)), pseudorandomness (y indistinguishable from random given PK, x without π), provability (π convinces verifier).\nECVRF (RFC 9381): based on elliptic curve discrete log; prove y = H(SK·H\'(x)) using DLEQ sigma protocol; compact proof (80-96 bytes on P-256).\nVXEDDSA/VRF-25519: Curve25519-based; used in Signal protocol for sealed sender feature and private contact discovery.\nBlockchain leader election: Algorand uses VRF to privately determine if a node should propose/vote in current round; prevents targeted DoS attacks on elected leaders.\nDNS security (NSEC5): VRF proves non-existence of domain without revealing zone contents; prevents zone enumeration attacks on DNSSEC.',
  },
  threshold_cryptography: {
    summary: 'Distribute cryptographic operations across n parties so any t+1 can cooperate to perform them, while t parties learn nothing.',
    explanation: 'Threshold (t,n) secret sharing: Shamir scheme; secret reconstructed by any t+1 participants; adversary controlling ≤ t parties sees no information.\nThreshold RSA (Shoup 1999): distributed key generation splits private key d into shares d_1,...,d_n; each party computes m^{d_i} mod N; combine via Lagrange in exponent.\nThreshold ECDSA: more complex — ECDSA uses nonce k that must be consistent but secret; GG18/GG20 protocols use MPC multiplication for k·d computation; Lindell 2021 for 2-of-n.\nDKG (Distributed Key Generation): generate shared public key without trusted dealer; Feldman VSS (Verifiable Secret Sharing): dealer broadcasts commitments to polynomial.\nTSS applications: cryptocurrency wallet security (no single point of compromise), bridge/multi-sig security, certificate authority protection, HSM alternatives.\nTendermint/BLS threshold signatures: aggregate n BLS signatures into one; any t+1 signers; O(1) verify cost; used in Ethereum PoS attestation aggregation.',
  },
  differential_privacy: {
    summary: 'A rigorous mathematical framework for quantifying privacy guarantees when releasing information about datasets.',
    explanation: 'Definition: mechanism M is (ε,δ)-DP if for all adjacent D,D\' (differing in one record) and all S: P[M(D)∈S] ≤ e^ε · P[M(D\')∈S] + δ; ε-DP when δ=0.\nLaplace mechanism: add Lap(Δf/ε) noise where Δf = global L1-sensitivity = max_{D,D\'} ||f(D)−f(D\')||₁; achieves pure ε-DP; optimal for 1D queries.\nGaussian mechanism: add N(0, σ²Δf₂²) where Δf₂ = L2-sensitivity; σ = (√2 log(1.25/δ))/ε; achieves (ε,δ)-DP; better for high-dimensional outputs.\nComposition: (ε₁,δ₁)-DP + (ε₂,δ₂)-DP = (ε₁+ε₂, δ₁+δ₂)-DP (basic); Rényi DP / moments accountant enables tighter composition over many rounds.\nDP-SGD (Abadi et al. 2016): clip per-sample gradients, add Gaussian noise, track privacy via moments accountant; used in Google Gboard, Apple on-device ML.\nLocal DP: users add noise before sending to server; randomized response (Warner 1965); Apple/Google use LDP for keyboard statistics, telemetry; weaker utility than central DP.',
  },

// ── Information Theory ───────────────────────────────────────

  information_theory_adv: {
    summary: 'Advanced information theory covers channel capacity, rate-distortion tradeoffs, and connections to statistics and learning theory.',
    explanation: 'Channel capacity C = max_{p(x)} I(X;Y) = max_{p(x)} Σ_{x,y} p(x,y) log(p(y|x)/p(y)); Shannon\'s channel coding theorem: reliable communication possible iff R < C.\nSource coding theorem: lossless compression achievable at rate H(X) bits/symbol; uniquely decodable iff Kraft inequality Σ 2^{−l_i} ≤ 1; Huffman and arithmetic coding achieve entropy.\nRate-distortion theory: D(R) = min_{p(x̂|x): I(X;X̂)≤R} E[d(X,X̂)]; fundamental limit of lossy compression; achieves optimal trade-off between rate and distortion.\nMutual information I(X;Y) = H(X)−H(X|Y) = D_{KL}(p(x,y)||p(x)p(y)); measures dependence; I(X;Y)=0 iff X,Y independent.\nData processing inequality: for Markov chain X→Y→Z: I(X;Z) ≤ I(X;Y); processing cannot increase information; no free information from transformations.\nFisher information I(θ) = E[(∂ log p(X;θ)/∂θ)²]; Cramér-Rao bound: Var(θ̂) ≥ 1/I(θ); connects to geometry of statistical models (information geometry).',
  },

// ── Mathematics (Additional) ─────────────────────────────────

  kolmogorov_complexity: {
    summary: 'Algorithmic information theory defines the complexity of a string as the length of its shortest description (program), providing a universal measure of information content.',
    explanation: 'Kolmogorov complexity K(x) = min{|p|: U(p)=x} where U is universal Turing machine; inherently machine-dependent but changes by at most additive constant.\nIncompressibility: K(x) ≥ |x| − c for most strings (incompressible/random); counting argument — only 2^{|x|−c} programs shorter than |x|−c.\nConditional complexity K(x|y): shortest program outputting x given y as input; K(x,y) = K(x) + K(y|x) + O(1) (chain rule).\nUndecidability: K(x) is not computable; no algorithm can compute K(x) for arbitrary x; reduction from halting problem.\nAIT and randomness: Martin-Löf random sequences: pass all effective statistical tests; equivalent to K(x₁...x_n) ≥ n−c (incompressible prefixes).\nApplications: MDL (Minimum Description Length) for model selection (prefer models that compress data well); Occam\'s razor formalization; normalized compression distance for clustering.',
  },
  game_theory_nash: {
    summary: 'Game theory studies strategic interactions among rational agents; Nash equilibrium characterizes stable strategy profiles.',
    explanation: 'Strategic-form game: players I, strategy spaces S_i, payoff functions u_i(s₁,...,s_n); Nash equilibrium: s* s.t. u_i(s*_i, s*_{−i}) ≥ u_i(s_i, s*_{−i}) for all s_i, all i.\nExistence: Nash (1950) — every finite game has a mixed strategy NE; proved via Brouwer fixed point theorem; finding NE is PPAD-complete.\nPrisoner\'s dilemma: (defect, defect) is unique NE but (cooperate, cooperate) Pareto-dominates; social dilemma between individual and collective rationality.\nZero-sum games: Von Neumann minimax theorem (1928): max_x min_y x^T Ay = min_y max_x x^T Ay; saddle point; solved as LP; first major game theory result.\nRefinements: subgame perfect NE (backward induction eliminates non-credible threats), sequential equilibrium, trembling-hand perfect equilibrium.\nApplications: mechanism design, spectrum auctions, traffic routing (Braess paradox), evolutionary game theory (ESS), poker (CFR algorithm for solving).',
  },
  mechanism_design: {
    summary: 'Mechanism design engineers the rules of a game to induce desired outcomes from self-interested strategic agents.',
    explanation: 'Reverse game theory: given desired social outcome, design mechanism (rules, payments) so that self-interested agents\' equilibrium strategies achieve it.\nDirect mechanism: agents report types θ_i; allocation f(θ) + payments t(θ); revelation principle: WLOG consider mechanisms where truthful reporting is a dominant strategy (DSIC).\nVCG mechanism: f*(θ) maximizes social welfare Σu_i; payments t_i(θ) = Σ_{j≠i} u_j(f*(θ)) − h_i(θ_{−i}); agent i pays externality imposed on others; DSIC + efficient.\nMyerson\'s optimal auction: revenue-maximizing mechanism for single item; virtual value ψ_i(θ_i) = θ_i − (1−F_i(θ_i))/f_i(θ_i); allocate to highest positive virtual value.\nVickrey-Clarke-Groves: generalization of second-price auction to combinatorial settings; second-price auction is VCG for single item; efficient but may not maximize revenue.\nBudget balance: VCG may not balance budget (Clarke pivot rule); trade-off between efficiency, incentive compatibility, and budget balance (Myerson-Satterthwaite impossibility).',
  },
  circuit_complexity: {
    summary: 'Circuit complexity studies computational problems through the lens of Boolean circuit size and depth, connecting to fundamental questions in complexity theory.',
    explanation: 'Boolean circuit: DAG with AND (fan-in 2), OR (fan-in 2), NOT gates; size = number of gates; depth = longest path from input to output (parallel time).\nAC⁰: circuits of constant depth and polynomial size; contains addition, but Hastad\'s 1986 theorem: PARITY ∉ AC⁰ — exponential lower bound on AC⁰ circuit size for parity.\nTC⁰: AC⁰ + MAJORITY gates; contains integer multiplication (Hesse-Allender-Barrington 2001); open whether PARITY ∈ TC⁰.\nP/poly: problems with polynomial-size nonuniform circuits; NP ⊆ P/poly would imply PH collapse; Karp-Lipton theorem; uniform vs nonuniform complexity.\nShannon\'s counting argument: almost all boolean functions f:{0,1}^n→{0,1} require circuits of size Ω(2^n/n); but no explicit function known to require superlinear circuits (major open problem).\nMonoton circuit lower bounds (Razborov 1985): clique requires exponential monotone circuits; Alon-Boppana for explicit functions; relativizes (unlike arithmetic circuits).',
  },
  communication_complexity: {
    summary: 'Communication complexity measures the minimum number of bits two parties must communicate to jointly compute a function of their distributed inputs.',
    explanation: 'Two-party model: Alice has x, Bob has y; both want f(x,y); count bits exchanged in worst case; deterministic CC(f) = min over protocols; log(matrix rank) lower bound.\nEquality function EQ_n: Alice and Bob check x=y; naive O(n) bits; lower bound Ω(n) via rank (identity matrix has rank 2^n).\nRandomized: R(f) with bounded error; fingerprinting protocol for EQ: hash x to O(log 1/δ) bits → R(EQ) = O(log n); exponential savings over deterministic.\nDisjointness DISJ_n: Alice/Bob have sets S,T ⊆ [n], check S∩T=∅; R(DISJ) = Θ(n) — fundamental lower bound via information complexity.\nKW (Karchmer-Wigderson) theorem: depth of boolean circuit for f = CC(K_f) for associated relation K_f; links circuit depth to communication complexity.\nApplications: VLSI lower bounds, data structures (cell-probe complexity), streaming algorithms (space lower bounds via communication reductions), distributed computing.',
  },
  derandomization: {
    summary: 'Derandomization shows that randomness often does not add computational power, constructing deterministic alternatives to randomized algorithms.',
    explanation: 'Pseudorandom generator (PRG): G:{0,1}^s → {0,1}^n stretches seed s ≪ n; ε-fools class C if |P_U[C accepts G(U_s)] − P[C accepts U_n]| < ε.\nHardness-randomness connection (Impagliazzo-Wigderson 1997): if E = DTIME(2^{O(n)}) requires circuits of size 2^{Ω(n)}, then BPP = P; hardness implies pseudorandomness.\nNisan-Wigderson PRG: use hard function h:{0,1}^k→{0,1} to construct PRG fools small circuits; seed length O(log^2 n).\nExpander graphs: d-regular graph G; adjacency matrix eigenvalues λ₁=d ≥ λ₂ ≥ ...; spectral gap d−λ₂ controls expansion; random walk mixes in O(log n) steps.\nZig-zag product (Reingold-Vadhan-Wigderson 2000): compose large expander with small explicit expander; achieves constant-degree expanders with optimal expansion explicitly.\nReingold\'s theorem (2004): undirected s-t connectivity in O(log n) space deterministically; previous best was O(log² n) (Savitch); uses expander graph derandomization.',
  },
  pseudorandom_generators: {
    summary: 'Cryptographic pseudorandom generators expand a short secret seed into a long stream of bits computationally indistinguishable from true randomness.',
    explanation: 'Security definition: G:{0,1}^k → {0,1}^n is secure PRG if for all PPT distinguishers D: |P[D(G(s))=1] − P[D(r)=1]| < negl(k); provably secure from one-way functions.\nStream ciphers: ChaCha20 (Bernstein): 256-bit key, 64-byte block from ARX (add-rotate-XOR) structure; widely used in TLS 1.3, WireGuard, Noise protocol.\nAES-CTR: AES(key, counter||nonce) for counter = 0,1,2,...; parallel generation; preferred for hardware with AES-NI instructions; used in GCM mode.\nBlum-Blum-Shub: s_{n+1} = s_n² mod N = pq (Blum primes p≡q≡3 mod 4); provably secure under quadratic residuosity assumption; slow, not practical.\nFortuna/Yarrow (Ferguson-Schneier): entropy accumulation pool; reseed from multiple sources (hardware RNG, OS events, network timing); entropy estimation.\nSeed security: /dev/urandom (Linux): CSPRNG seeded from hardware events, jitter, CPU RNG (RDSEED/RDRAND); /dev/random blocked until sufficient entropy in older kernels.',
  },
  program_synthesis: {
    summary: 'Automatically generate programs from high-level specifications such as input-output examples, types, or formal properties.',
    explanation: 'Programming by example (PBE): given {(x_i, y_i)}: find program P s.t. P(x_i)=y_i for all i; search over program space guided by examples.\nFlashFill (Gulwani 2011, Excel): synthesize string transformations (split, concat, extract, replace) from 1-2 examples; DAG-based representation; PROSE framework.\nSyGuS (Syntax-Guided Synthesis): grammar defines syntactic space; semantic specification (LTL, I/O examples, logical formula); CEGIS (Counterexample-Guided Inductive Synthesis): solver proposes, verifier refutes.\nSketch: programmer provides partial program with holes ??; synthesis fills holes from finite grammar; reduces to SAT/SMT solving; type-directed hole filling.\nDeductive synthesis: backward application of specification to generate program; Manna-Waldinger (1980); works for well-structured domains (sorting, arithmetic).\nLLM-assisted synthesis: GitHub Copilot, AlphaCode use transformer models trained on code; top-k sampling with test filtering (AlphaCode tournament); advances in functional correctness but not formal guarantees.',
  },
  abstract_interpretation: {
    summary: 'A framework for sound static program analysis that over-approximates program semantics using abstract domains to prove properties automatically.',
    explanation: 'Concrete semantics: collect all possible program states C = ℘(Σ); concrete transformer f: ℘(Σ)→℘(Σ); fixed-point semantics lfp(f) gives all reachable states.\nAbstraction: Galois connection (α, γ) between concrete lattice ℘(Σ) and abstract lattice A; α (abstraction) and γ (concretization) satisfy α∘γ = id and α∘γ ≥ id.\nAbstract transformer: f# computes over-approximation; soundness: α(f(γ(a))) ≤ f#(a); false alarms (false positives) possible, no false negatives by design.\nAbstract domains: Interval domain [l,u] tracks variable ranges; Octagons: ±x_i ± x_j ≤ c (polynomial cost); Convex Polyhedra (Cousot-Halbwachs): most precise but expensive.\nWidening ▽: ensures convergence of fixed-point computation in finite steps; deliberately loses information to prevent infinite ascending chains.\nAstrée analyzer: formally verified absence of all run-time errors (overflow, division by zero, etc.) in Airbus A380/A350 flight control software; industrial impact of abstract interpretation.',
  },
  formal_methods_tla: {
    summary: 'TLA+ is a formal specification language for describing and verifying concurrent and distributed systems using temporal logic.',
    explanation: 'TLA+ (Temporal Logic of Actions, Lamport 1999): specify system as state machine; state: assignment of values to variables; action: state transition predicate.\nSpec structure: INIT predicate (initial states) + NEXT predicate (allowed transitions); safety: INIT ∧ □[NEXT]_vars; liveness: ◇P (eventually P), □◇P (infinitely often P).\nTemporal operators: □ (always/invariant), ◇ (eventually), □◇ (infinitely often), ~> (leads to); express deadlock freedom, progress, fairness.\nTLC model checker: exhaustively explore state space for finite models; finds violation traces; parameterized state spaces (vary system size); concurrent workers.\nPlusCal algorithm language: pseudo-code that compiles to TLA+; easier to write algorithms; translates while-loops, if-else to TLA+ operators.\nIndustrial use: Amazon AWS (Newcombe et al. 2015): 10 systems specified in TLA+, found bugs including safety violations in distributed transactions; Intel uses for CPU microcode verification.',
  },
  model_checking_algo: {
    summary: 'Automated verification of finite-state systems against temporal logic specifications by exhaustive state space exploration.',
    explanation: 'Model checking problem: given system M = (S, S₀, R, L) (Kripke structure) and formula φ in CTL or LTL, does M ⊨ φ? Decidable for finite M.\nCTL (Computation Tree Logic): branching-time; ∀□, ∃□, ∀◇, ∃◇ quantify over paths; model checking CTL O(|M|·|φ|) (linear); used in NUSMV, UPPAAL.\nLTL (Linear Temporal Logic): linear-time; single path; LTL model checking = intersection of system automaton and Büchi automaton for ¬φ; PSPACE-complete.\nBDD (Binary Decision Decision Diagram): canonical compressed representation of boolean functions; symbolic model checking: represent sets of states as BDDs; handles 10^{20+} states.\nSAT-based BMC (Bounded Model Checking): unroll k transitions, encode as SAT formula, check for counterexample length ≤ k; effective for finding bugs quickly.\nCEGAR (Counterexample-Guided Abstraction Refinement): abstract system, check abstraction, if spurious counterexample refine abstraction; handles infinite-state systems approximately.',
  },

  // ════ B15 ════

  // ── OS ADVANCED ────────────────────────────────────────────────
  process_scheduling_advanced: {
    summary: 'Modern OS schedulers use priority-based preemptive algorithms; Linux CFS uses a virtual runtime red-black tree to approximate fair CPU sharing.',
    explanation: 'CFS (Completely Fair Scheduler): assigns each task a vruntime (cpu_time / weight); picks leftmost node in rb-tree (smallest vruntime) to run next.\nNice values map to weights (nice -20 → weight 88761; nice 0 → 1024; nice 19 → 15).\nScheduling classes: SCHED_FIFO, SCHED_RR (real-time, bypass CFS), SCHED_DEADLINE (EDF/CBS for hard RT).\nGroup scheduling: cgroups cpu.shares/cpu.quota creates hierarchy; vruntime tracked per group.\nMigration: load balancer moves tasks between per-CPU run queues every tick; NUMA-aware.\nContext switch cost: ~1–5 µs; TLB flush on address-space switch; mitigate with huge pages.',
  },
  virtual_memory_advanced: {
    summary: 'Virtual memory uses page tables and a TLB to map per-process virtual addresses to physical frames, enabling isolation, demand paging, and memory overcommit.',
    explanation: 'x86-64 4-level page table: PML4 → PDPT → PD → PT → 4KB page; 9+9+9+9+12 bits.\nTLB: fully-associative cache of recent PTE lookups; CR3 load (context switch) flushes TLB unless PCID.\nHuge pages (2MB/1GB): reduce TLB pressure for large working sets; transparent hugepages (THP) or explicit mmap MAP_HUGETLB.\nDemand paging: page fault (#PF) on first access → kernel allocates frame, maps PTE; copy-on-write (COW) for fork().\nSwap: anonymous pages evicted via LRU/CLOCK to swap device; swap prefetch avoids future faults.\nKSM (Kernel Same-page Merging): deduplicate identical pages across VMs; useful in hypervisors.\nmadvise(MADV_HUGEPAGE/MADV_SEQUENTIAL/MADV_DONTNEED) hints to kernel for optimal behavior.',
  },
  file_system_internals: {
    summary: 'Filesystems manage on-disk layout of inodes, data blocks, and journals; modern designs like ZFS/Btrfs use copy-on-write for crash consistency and snapshots.',
    explanation: 'ext4: inode (metadata) + extents (contiguous block ranges) + journal for metadata consistency.\nJournaling modes: writeback (data unsafe), ordered (data before metadata commit), journal (safest, expensive).\nZFS: 128-bit CoW B-tree (DSL); transaction groups commit atomically; checksum every block; dedup/compression.\nBtrfs: CoW B-tree with inline extents, checksums, subvolumes, and snapshots; still maturing.\nVFS layer: common file_operations interface; dentry cache (dcache) and inode cache for hot paths.\nDirectIO/O_DIRECT: bypass page cache; useful for databases managing own buffer pool.\nfio benchmarks: IOPS (random 4K), throughput (seq 128K), latency; important for SSD vs NVMe evaluation.',
  },
  container_linux_namespaces: {
    summary: 'Linux containers use namespaces for isolation and cgroups for resource control, forming the foundation of Docker and Kubernetes without hardware virtualization.',
    explanation: 'Namespaces (kernel 3.8+): PID (process ID tree), NET (network stack), MNT (mount points), UTS (hostname), IPC (SysV/POSIX IPC), USER (UID mapping), CGROUP.\nclone(CLONE_NEWPID|CLONE_NEWNET|...) creates new namespace; unshare(1) from shell.\nCgroups v2: unified hierarchy; cpu.weight, memory.max, io.max; freezer for SIGSTOP-like.\nOverlayFS: union mount of lower (read-only image layers) + upper (writable container layer); efficient image distribution.\nSeccomp: syscall filtering via BPF program; Docker default profile blocks ~44 risky syscalls.\nCapabilities: fine-grained privileges (CAP_NET_ADMIN, CAP_SYS_PTRACE) vs all-or-nothing root.\nrootless containers: user namespace UID mapping allows non-root daemon (Podman, rootless Docker).',
  },
  ebpf_linux: {
    summary: 'eBPF allows safe, sandboxed programs to run in the Linux kernel at hook points, enabling zero-overhead observability, networking, and security without kernel modules.',
    explanation: 'Architecture: eBPF bytecode verified (DAG, bounded loops) → JIT compiled to native instructions; runs in kernel context.\nHook types: kprobe/kretprobe (arbitrary function entry/exit), tracepoints (static), XDP (NIC driver, pre-stack), tc (traffic control), uprobe (user-space), LSM hooks.\nMaps: shared key-value stores between kernel and user-space; types: hash, array, perf_event_array, ringbuf, LRU_hash.\nBCC / libbpf / bpftrace: toolchains for writing eBPF programs; CO-RE (Compile Once Run Everywhere) via BTF.\nUse cases: Cilium (eBPF-based Kubernetes CNI), Falco (security), pixie (profiling), Katran (load balancer).\nXDP performance: drop/redirect packets at NIC level (~14Mpps on single core) before sk_buff allocation.\nbpftool prog/map: inspect loaded programs and maps; essential for debugging.',
  },
  kernel_bypass_dpdk: {
    summary: 'DPDK (Data Plane Development Kit) bypasses the kernel network stack by polling NIC queues from user-space, achieving line-rate packet processing with predictable low latency.',
    explanation: 'Architecture: PMD (Poll Mode Driver) runs in dedicated core loop (busy poll); no interrupts; zero-copy via DMA.\nHugepages: DPDK requires 2MB/1GB hugepages for mempool; avoids TLB misses on packet buffers.\nMempool: pre-allocated ring of rte_mbuf (packet buffers); lock-free SPSC ring for inter-core hand-off.\nRSS (Receive Side Scaling): NIC distributes flows to multiple queues/cores via Toeplitz hash; per-flow affinity.\nVirtIO-net / VFIO: pass NIC directly to DPDK process using IOMMU (VFIO); safe DMA from user-space.\nNFV/VNF: DPDK enables software routers, firewalls, load balancers at 40–100Gbps.\nAlternatives: AF_XDP (eBPF-based, shares IRQ), io_uring (file I/O), RDMA verbs (HPC).',
  },
  io_uring_async: {
    summary: 'io_uring (Linux 5.1+) provides a high-performance asynchronous I/O interface using shared ring buffers between kernel and user-space, eliminating syscall overhead.',
    explanation: 'Two rings: SQ (submission queue) for I/O requests, CQ (completion queue) for results; both shared via mmap.\nFixed file/buffer registration: pre-registers fd/buffer descriptors to avoid per-op reference counting overhead.\nSQPOLL mode: kernel thread polls SQ ring; zero-syscall I/O when throughput is high enough.\nLinked requests: chain dependent ops (read → write) without user-space polling between them.\nSupported ops: read/write, send/recv, accept, connect, fsync, splice, openat, statx, multishot accept.\nPerformance: 2× throughput vs epoll for high-IOPS storage; critical for Rust async runtimes (tokio-uring).\nProactor pattern: completion-based (vs epoll readiness); fits naturally with Rust futures / C++ coroutines.',
  },
  hypervisor_design: {
    summary: 'Hypervisors virtualize hardware to run multiple OS instances; Type 1 (bare-metal) has direct hardware access, while KVM turns Linux into a Type 1 hypervisor via hardware extensions.',
    explanation: 'Type 1 (bare-metal): Xen, ESXi, Hyper-V; hypervisor runs at ring -1 (VMX root mode); guests run at ring 0 in VMX non-root.\nKVM: Linux kernel module; VMCS (Intel VT-x) or VMCB (AMD-V) stores guest state; QEMU handles device emulation.\nVM exits: sensitive instructions (CPUID, I/O, rdmsr) trap to hypervisor; minimize exits for performance.\nVirtIO: paravirtual device protocol; guest driver writes to virtqueue ring buffer; host backend (vhost-net, vhost-blk) serves requests directly.\nSR-IOV: NIC exposes virtual functions (VFs) passed through to VMs; near-native NIC performance.\nNested virtualization: VM running a hypervisor; VMX support nested (L0→L1→L2); performance overhead 2–5×.\nSEV-SNP (AMD) / TDX (Intel): memory encryption + remote attestation; confidential computing.',
  },
  realtime_os_rtos: {
    summary: 'Real-time operating systems guarantee deterministic task scheduling with bounded latency; hard RTOS (FreeRTOS, Zephyr) differ from soft RT (Linux PREEMPT_RT).',
    explanation: 'Hard RT: deadline miss = system failure; used in airbags, flight control, medical devices.\nScheduling: Rate Monotonic (RM)—fixed priority = 1/period; EDF (Earliest Deadline First)—optimal utilization; PREEMPT_RT converts Linux spinlocks to RT mutexes.\nFreeRTOS: tick-based preemptive scheduler; tasks, queues, semaphores, timers; <10KB ROM footprint; runs on Cortex-M.\nZephyr: POSIX-compatible RTOS by Linux Foundation; device tree, Kconfig; broad MCU support including RISC-V.\nPriority inversion: high-priority task blocked by low-priority via mutex; fix with priority inheritance or priority ceiling.\nJitter sources: cache misses, interrupt latency, memory bus contention; measure with cyclictest.\nDeterminism: disable dynamic memory allocation (use static/pool); pre-run stack depth checks.',
  },
  // ── COMPUTER VISION ───────────────────────────────────────────
  image_processing_basics: {
    summary: 'Image processing applies mathematical filters to pixel grids; convolution, morphological operations, and color space transforms form the foundation of computer vision.',
    explanation: 'Convolution: slide kernel over image; separable kernels (Gaussian) reduce O(k²) to O(2k) per pixel.\nGaussian blur: low-pass filter; σ controls smoothing; used before edge detection to remove noise.\nColor spaces: RGB→HSV for hue-based segmentation; RGB→LAB for perceptual uniformity; YCrCb for skin detection.\nHistogram equalization: redistribute intensity CDF to uniform; CLAHE (adaptive) avoids over-amplification.\nMorphological ops: erosion (min), dilation (max), opening (erosion→dilation), closing; structural element shape matters.\nDFT/FFT in imaging: high frequencies = edges/noise; low-pass filtering in frequency domain; Wiener deconvolution.\nImage pyramids (Gaussian/Laplacian): multi-scale analysis; backbone of feature matching and optical flow.',
  },
  edge_detection_cv: {
    summary: 'Edge detection finds boundaries in images by identifying rapid intensity changes; Canny is the gold standard, combining gradient magnitude with non-maximum suppression and hysteresis.',
    explanation: 'Sobel: convolve with horizontal/vertical derivative kernels; combine as √(Gx²+Gy²); fast but noisy.\nCanny pipeline: Gaussian smooth → Sobel gradient → non-maximum suppression (thin edges to 1px) → double threshold → hysteresis (link weak pixels adjacent to strong).\nLaplacian of Gaussian (LoG): second derivative; zero crossings = edges; scale-normalized LoG forms DoG (Difference of Gaussians).\nHough transform: detect lines/circles in edge map; parameterize (ρ,θ), accumulate votes; Probabilistic Hough for efficiency.\nStructured forests / HED: learned edge detectors; CNN feature hierarchy improves over hand-crafted.\nEdge quality metrics: precision/recall vs ground-truth contours (BSDS500 benchmark).\nApplications: lane detection, document scanning, industrial inspection.',
  },
  feature_extraction_cv: {
    summary: 'Local feature detectors find distinctive keypoints; descriptors encode their appearance for robust matching across scale, rotation, and lighting changes.',
    explanation: 'SIFT: DoG detector + 128-D gradient histogram descriptor; scale/rotation invariant; patented (use ORB as free alternative).\nORB: FAST detector + BRIEF descriptor (binary, XOR matching); 100× faster than SIFT; used in SLAM.\nHOG (Histogram of Oriented Gradients): dense gradient histograms in cells + blocks normalization; classic pedestrian detector (DPM, SVM).\nSURF: Hessian determinant detector + Haar wavelet descriptor; fast approximation of SIFT.\nMatching: brute-force (k-NN) or FLANN (approximate); ratio test (Lowe) filters ambiguous matches; RANSAC removes outliers.\nSuperPoint: self-supervised learned keypoint + descriptor; covariant with homographic adaptation.\nKeypoint descriptors underpin SfM, visual SLAM, image stitching, and object recognition pipelines.',
  },
  optical_flow_cv: {
    summary: 'Optical flow estimates per-pixel motion between frames; Lucas-Kanade tracks sparse keypoints, while Farneback and deep methods compute dense flow fields.',
    explanation: 'Brightness constancy: I(x,y,t) = I(x+u, y+v, t+1); combined with Taylor expansion → optical flow constraint equation (one equation, two unknowns).\nLucas-Kanade: assumes constant flow in local neighborhood; solves least-squares; pyramidal LK handles large displacements.\nHorn-Schunck: global smoothness regularization; variational formulation; dense but slow.\nFarneback: polynomial expansion of local image structure; dense flow in O(n) per pixel.\nDeep methods: PWCNet, RAFT (recurrent all-pairs field transforms); iterative refinement with correlation volume; RAFT achieves <1px AEPE on Sintel.\nScene flow: 3D motion estimation from depth+RGB; used in autonomous driving perception.\nApplications: video stabilization, action recognition (TV-L1 flow input), drone navigation.',
  },
  stereo_vision_3d: {
    summary: 'Stereo vision computes depth by matching corresponding pixels in left-right image pairs; disparity is inversely proportional to depth via the baseline-focal-length relationship.',
    explanation: 'Baseline B, focal length f, disparity d: depth Z = B·f / d; larger baseline → better depth resolution at distance.\nRectification: align epipolar lines horizontally so matching is 1-D search; requires intrinsic + extrinsic calibration.\nSGM (Semi-Global Matching): dynamic programming along 8/16 directions with smoothness penalty; balances accuracy vs speed.\nCost volume: 3D tensor (H×W×D) of matching costs; WTA (winner-takes-all) or belief propagation to extract disparity.\nActive stereo: project structured light (Intel RealSense, Kinect); improves matching in textureless regions.\nActive vs passive: LiDAR (high accuracy), structured light (close range), time-of-flight (noisy), stereo (passive, long range).\nDL stereo: PSMNet, CREStereo (ViT-based); outperforms SGM on KITTI benchmark.',
  },
  object_detection_yolo: {
    summary: 'Object detection predicts bounding boxes and class labels; YOLO processes images in a single forward pass for real-time performance, while R-CNN family uses region proposals for accuracy.',
    explanation: 'Two-stage (R-CNN family): RPN (Region Proposal Network) generates ~300 proposals → ROI Pooling → classifier; Faster R-CNN ~5 FPS; accurate.\nOne-stage (YOLO): divide image into S×S grid; each cell predicts B boxes + confidence + C classes; YOLOv5-v9 at 50–200 FPS on GPU.\nAnchor boxes: predefined aspect ratios clustered from dataset; YOLOv8 uses anchor-free (predict center offset directly).\nLoss: classification (BCE), bounding box (CIoU/GIoU for overlap quality), objectness; focal loss (RetinaNet) handles class imbalance.\nNMS (Non-Maximum Suppression): remove overlapping boxes above IoU threshold; Soft-NMS reduces duplicate suppression.\nEvaluation: mAP (mean Average Precision) at IoU=0.5 or 0.5:0.95; COCO benchmark standard.\nTransformer-based: DETR (end-to-end, no NMS); DINO-DETR state-of-the-art on COCO.',
  },
  image_segmentation_cv: {
    summary: 'Image segmentation assigns a class label to every pixel; semantic segmentation labels pixels by category, instance segmentation distinguishes individual objects, and panoptic combines both.',
    explanation: 'Semantic: FCN (fully convolutional); U-Net (skip connections for fine detail); DeepLab (atrous convolution + ASPP for multi-scale context).\nInstance: Mask R-CNN extends Faster R-CNN with mask prediction head; each instance gets binary mask.\nPanoptic: stuff (amorphous background) + things (countable objects); PanopticFPN, Panoptic-DeepLab.\nSegment Anything Model (SAM): promptable segmentation; trained on 1B masks; zero-shot generalization.\nLoss: cross-entropy per pixel; Dice loss for class imbalance; combination (CE + Dice) common in medical imaging.\nEvaluation: mIoU (mean intersection over union); AP for instance masks (COCO-style).\nChallenges: small objects, thin structures, domain shift; medical imaging uses nnU-Net for robust baselines.',
  },
  pose_estimation_cv: {
    summary: 'Human pose estimation detects body keypoints (joints) from images; bottom-up methods detect all keypoints then group, top-down methods crop persons then estimate.',
    explanation: 'Top-down: detect persons (YOLO/Faster RCNN) → crop → run single-person pose estimator (HRNet, ViTPose); high accuracy, slow with many people.\nBottom-up: OpenPose (PAFs—Part Affinity Fields connect keypoints to instances); faster for crowd scenes.\nHeatmap representation: Gaussian blob at ground-truth keypoint; network predicts H×W×K heatmaps; argmax gives location.\nGlobal context: transformers (ViTPose) capture long-range joint dependencies; beats CNN-based at same parameter count.\n3D pose: lift 2D keypoints via VideoPose3D; video temporal smoothing reduces jitter.\nHand/face pose: MediaPipe provides real-time 21-point hand, 468-point face mesh on mobile.\nApplications: action recognition, AR/VR avatar driving, sports analytics, gait analysis.',
  },
  face_recognition_cv: {
    summary: 'Face recognition maps face images to a compact embedding space where same-identity faces cluster together; ArcFace maximizes angular margin for discriminative embeddings.',
    explanation: 'Pipeline: detect (MTCNN/RetinaFace) → align (5-point landmark affine warp) → embed (ResNet/ViT) → compare (cosine similarity).\nLoss functions: Softmax (baseline) → SphereFace (multiplicative margin) → CosFace (additive cosine margin) → ArcFace (additive angular margin m=0.5; best uniformity on sphere).\nTraining data: MS-Celeb-1M, VGGFace2 (millions of images, thousands of identities); data augmentation + hard negative mining.\nVerification: 1:1 comparison (authentication); threshold at FAR=0.001%; Identification: 1:N search in gallery.\nAge/occlusion/pose variation: masked face recognition became important post-2020; FaceX-Zoo benchmark.\nAnti-spoofing (liveness detection): detect 2D photo/video replay attacks via texture analysis, depth, IR.\nPrivacy concerns: GDPR Article 9; on-device inference (Apple FaceID secure enclave) preferred over cloud.',
  },
  depth_estimation_cv: {
    summary: 'Depth estimation infers per-pixel distance from camera; supervised methods use LiDAR ground truth, while self-supervised methods learn from stereo pairs or monocular video.',
    explanation: 'Supervised monocular: encode image → predict depth map; BerHu loss robust to outliers; trained on NYU/KITTI with sparse LiDAR labels.\nSelf-supervised (Monodepth2): minimize photometric reprojection error between video frames using predicted depth + pose; no LiDAR needed.\nDepth completion: densify sparse LiDAR points using guided image convolutions; used in autonomous driving (IP-Basic, NLSPN).\nMetric vs relative depth: most monocular methods predict up-to-scale; MiDaS uses mix of datasets for zero-shot relative depth.\nFoundation models: Depth Anything v2 (ViT-Large encoder); best zero-shot relative depth.\nFusion: RGB-D cameras (structured light/ToF + RGB); depth alignment and extrinsic calibration.\nApplications: robot grasping, AR occlusion, 3D reconstruction, autonomous driving.',
  },
  slam_robotics: {
    summary: 'SLAM (Simultaneous Localization and Mapping) estimates robot trajectory while building a map; visual SLAM uses cameras instead of LiDAR for lightweight deployment.',
    explanation: 'Filtering-based (EKF-SLAM): linearize motion/observation models; O(N²) update cost limits scale.\nGraph-based SLAM: pose graph with edges from odometry + loop closures; optimize with g2o/GTSAM (nonlinear least-squares).\nORB-SLAM3: feature-based; builds sparse map; loop detection via bag-of-words (DBoW2); relocalization.\nLiDAR SLAM: LOAM, LeGO-LOAM, LIO-SAM; scan matching (ICP/NDT) for accurate 3D map; used in autonomous vehicles.\nDense visual odometry: DSO (Direct Sparse Odometry); photometric bundle adjustment; no feature extraction.\nVIO (Visual-Inertial Odometry): IMU pre-integration + camera; VINS-Mono, MSCKF; degeneracy handling.\nNeRF-SLAM (iMAP, NICE-SLAM): implicit neural map + camera tracking; dense but compute-intensive.',
  },
  video_understanding_cv: {
    summary: 'Video understanding models temporal relationships across frames for action recognition, temporal localization, and video-language tasks using 3D convolutions or attention.',
    explanation: '3D CNNs: C3D, I3D (inflate 2D kernels to 3D); model spatiotemporal patterns; expensive (T×H×W).\nTwo-stream: RGB stream (appearance) + optical flow stream (motion); late fusion; classic Simonyan-Zisserman.\nSlow-Fast: slow pathway (low frame rate, spatial detail) + fast pathway (high frame rate, motion).\nVideo transformers: TimeSformer (divided space-time attention); VideoMAE (masked autoencoding pretraining); ViT-based.\nTemporal action detection: locate start/end of actions; BMN, TALNet use temporal anchors.\nVideo QA / VideoChat: cross-modal retrieval; CLIP4Clip, Video-LLaMA bridge vision-language.\nDatasets: Kinetics-700 (action recognition), AVA (atomic visual actions), Something-Something (temporal reasoning).',
  },
  camera_calibration_cv: {
    summary: 'Camera calibration determines intrinsic (focal length, principal point, distortion) and extrinsic (pose) parameters, enabling metric 3D reconstruction and undistortion.',
    explanation: 'Pinhole model: image point x = K[R|t]X; K = [[f,0,cx],[0,f,cy],[0,0,1]]; intrinsic matrix.\nDistortion: radial (barrel/pincushion) k1,k2,k3; tangential p1,p2; corrected via undistort (OpenCV).\nZhang\'s method: print checkerboard, take ≥3 images; compute homographies; solve for K using closed-form constraints; refine with Levenberg-Marquardt.\nStereo calibration: calibrate each camera individually, then compute relative R,t; enables rectification.\nFisheye: equidistant/equirectangular projection; Kannala-Brandt model for >90° FOV lenses.\nAprilTag / ChArUco: coded calibration targets; robust detection even at oblique angles.\nReprojection error: RMS < 0.5px is good; high error → blurry images or insufficient coverage.',
  },
  multi_view_geometry: {
    summary: 'Multi-view geometry formalizes the relationship between 3D points and their 2D projections across multiple cameras; the fundamental and essential matrices encode epipolar constraints.',
    explanation: 'Epipolar geometry: corresponding point x in image 1 lies on epipolar line l=Fx in image 2; F is 3×3 rank-2 fundamental matrix.\nFundamental matrix F (uncalibrated): estimated from 8+ correspondences (8-point algorithm + SVD); RANSAC for robustness.\nEssential matrix E = K₂ᵀFK₁ (calibrated); encodes R and t (up to scale); decompose via SVD for camera pose.\nHomography H: planar scene or pure rotation; x₂~Hx₁; direct linear transform + RANSAC; used for panorama stitching.\nStructure from Motion (SfM): COLMAP; incremental reconstruction from unordered photos; bundle adjustment refines camera poses + 3D points jointly.\nPnP (Perspective-n-Point): given 3D points + 2D correspondences, solve camera pose; EPnP O(n) solution.\nTriangulation: given two camera matrices + correspondences, find 3D point by DLT linear solve.',
  },
  visual_odometry_cv: {
    summary: 'Visual odometry estimates camera motion from image sequences; monocular VO operates up to scale, while stereo/RGB-D VO recovers metric scale.',
    explanation: 'Feature-based VO: extract features → match → estimate essential matrix → recover R,t → triangulate landmarks → local BA.\nDirect VO: optimize photometric error over all pixels; DSO minimizes point photometric error across sliding window.\nScale drift: monocular VO accumulates scale error; correct with loop closure or fusion with IMU/GPS.\nStereo VO: known baseline provides metric scale; LIBVISO2, stereo DSO; used in many AV systems.\nKeyframe selection: insert new keyframe when baseline/overlap threshold exceeded; important for efficiency.\nBundle adjustment: jointly refine poses + 3D points; g2o, Ceres Solver; local BA (sliding window) vs global.\nVO vs SLAM: VO estimates trajectory without explicit loop closure; SLAM detects revisited places for global consistency.',
  },
  reconstruction_3d_cv: {
    summary: '3D reconstruction recovers scene geometry from images; MVS computes dense point clouds from calibrated views, while NeRF and Gaussian splatting learn implicit/explicit neural representations.',
    explanation: 'MVS (Multi-View Stereo): COLMAP, OpenMVS; depth map fusion from many views → dense point cloud → surface (Poisson reconstruction).\nNeRF (Neural Radiance Field): MLP maps (x,y,z,θ,φ) → (RGB, σ); volume rendering integral; trained per-scene in hours; novel view synthesis.\nInstant-NGP: hash encoding of spatial features; reduces training to minutes; widely used.\n3D Gaussian Splatting: explicit Gaussians with SH color + opacity; real-time rendering at 100+ FPS; competitive quality to NeRF.\nMesh reconstruction: Marching Cubes extracts mesh from SDF/occupancy grid; remeshing for clean topology.\nDeep MVS: MVSNet uses cost volume over feature planes; learns view aggregation end-to-end.\nApplications: cultural heritage preservation, AR content creation, autonomous vehicle HD mapping.',
  },
  scene_understanding_cv: {
    summary: 'Scene understanding goes beyond detection to parse spatial relationships, attributes, and semantic structure; panoptic segmentation and scene graph generation are key tasks.',
    explanation: 'Panoptic segmentation: predict per-pixel class (stuff: sky, road) + instance ID (things: car #1, person #2); merged from semantic + instance branches.\nScene graphs: nodes (objects) + edges (relationships: "man riding horse"); Visual Genome dataset; used for image captioning, VQA.\nSpatial layout: room layout estimation (Manhattan World assumption); horizon line + wall/floor/ceiling labeling.\nDepth-aware understanding: frustum PointNets, BEV (bird\'s-eye view) detection; fuse LiDAR + camera.\nOpen-vocabulary segmentation: CLIP embeddings enable novel category segmentation; OpenSeg, FC-CLIP.\nFoundation models: SAM (segment anything) + DINO (self-supervised features) = strong open-world perception.\nDatasets: ADE20K (150 semantic categories), Cityscapes (driving scenes), ScanNet (3D indoor).',
  },
  tracking_algorithms_cv: {
    summary: 'Object tracking follows targets across video frames; SORT uses Kalman filter + Hungarian matching, while DeepSORT and ByteTrack add appearance embeddings for robust multi-object tracking.',
    explanation: 'Single Object Tracking (SOT): SiamFC (template matching in feature space); OSTrack (one-stream ViT); VOT benchmark.\nMulti-Object Tracking (MOT): detect-then-track paradigm; association via IoU (SORT) or deep embedding distance (DeepSORT).\nKalman filter: state = [x,y,w,h,vx,vy,vw,vh]; linear prediction; update on matched detections.\nHungarian algorithm: optimal assignment between detections and tracks; O(n³) solved in practice for small n.\nByteTrack: also associate low-confidence detections to reduce ID switches; SOTA on MOT17/MOT20.\nRe-ID: appearance embedding (ResNet/ViT trained on Market-1501) for long-term re-identification after occlusion.\nEvaluation: MOTA (accuracy: FP+FN+IDs/GT), IDF1 (identity consistency), HOTA (tracks+detection balance).',
  },
  generative_cv_models: {
    summary: 'Generative models synthesize realistic images; GANs use adversarial training, diffusion models iteratively denoise from Gaussian noise, and both achieve photorealistic quality.',
    explanation: 'GAN: generator G produces fake images; discriminator D classifies real vs fake; minimax objective min_G max_D E[log D(x)] + E[log(1-D(G(z)))].\nStyleGAN2/3: progressive training + style modulation; state-of-the-art unconditional image synthesis; faces/textures.\nDiffusion models: learn to denoise x_t → x_{t-1}; DDPM forward (add noise), reverse (denoise with U-Net); sample quality surpasses GANs.\nLatent diffusion (Stable Diffusion): encode to latent space with VAE; denoise in latent; much faster than pixel diffusion.\nCFG (Classifier-Free Guidance): jointly train conditional/unconditional; guidance scale ω trades diversity for prompt adherence.\nDiT (Diffusion Transformer): replace U-Net backbone with ViT; Sora-style video generation.\nEvaluation: FID (Fréchet Inception Distance); CLIP score for text-image alignment; LPIPS for perceptual quality.',
  },
  // ── NLP ────────────────────────────────────────────────────────
  tokenization_nlp: {
    summary: 'Tokenization splits text into subword units; BPE and WordPiece balance vocabulary size with coverage of rare words, enabling efficient training on diverse text corpora.',
    explanation: 'BPE (Byte-Pair Encoding): merge most frequent character pairs iteratively; GPT uses BPE with ~50K vocab; byte-level BPE handles any Unicode.\nWordPiece: like BPE but maximizes likelihood of training data; BERT uses 30K vocab; unknown words split into ##subwords.\nSentencePiece: language-agnostic; unigram LM or BPE; trained directly on raw text; used in mT5, ALBERT, LLaMA.\nTokenization artifacts: "lower" vs "Lower" may be different tokens; leading space matters (▁token); GPT-2 adds space before words.\nVocabulary size tradeoff: large vocab → fewer tokens per sentence (faster inference) but sparse embeddings for rare tokens.\nToken budget: context length limit (4K-200K tokens); affects document processing strategy.\nSpecial tokens: [CLS], [SEP], [PAD] in BERT; <bos>, <eos>, <unk> in GPT; positional embeddings differ per model.',
  },
  word_embeddings_nlp: {
    summary: 'Word embeddings map words to dense vectors where semantic similarity corresponds to geometric proximity; Word2Vec, GloVe, and FastText learn from co-occurrence statistics.',
    explanation: 'Word2Vec: predict center word from context (CBOW) or context from center (Skip-gram); negative sampling approximates softmax; learns analogies (king-man+woman≈queen).\nGloVe: factorize word co-occurrence matrix; combines global statistics with local context; vector differences encode meaning.\nFastText: character n-gram embeddings + word embedding; handles OOV and morphologically rich languages.\nContextual embeddings (ELMo): bi-LSTM language model; word representation depends on context; precursor to transformers.\nStatic vs contextual: Word2Vec gives same vector regardless of context; BERT changes representation per sentence.\nEmbedding arithmetic: semantic analogy as vector offset; works for gender, capital-country, etc.\nVisualization: t-SNE/UMAP reduces to 2D; clusters reveal semantic neighborhoods; useful for diagnosing quality.',
  },
  attention_mechanism_nlp: {
    summary: 'Attention allows models to focus on relevant parts of the input; self-attention computes pairwise interactions between all positions, enabling global context modeling without recurrence.',
    explanation: 'Scaled dot-product attention: Attention(Q,K,V) = softmax(QKᵀ/√d_k)V; Q,K,V are linear projections of input.\nMulti-head attention: h parallel attention heads with different projection matrices; concatenate + project; captures different relationship types.\nSelf-attention: Q=K=V from same sequence; each position attends to all others; O(n²) time/memory.\nCross-attention: Q from decoder, K/V from encoder; aligns decoder output to encoder representations.\nFlash Attention: IO-aware tiled computation; avoids materializing full n×n attention matrix; ~3× speedup, memory-efficient.\nSparse attention: Longformer (local window + global tokens), BigBird (random+local+global); reduce O(n²) to O(n log n).\nAttention interpretability: attention weights not always faithful explanations; gradient-based methods more reliable.',
  },
  transformer_architecture_nlp: {
    summary: 'The Transformer replaces recurrence with stacked self-attention layers and position-wise feed-forward networks, enabling parallelizable training and superior long-range dependency modeling.',
    explanation: 'Encoder: N layers of (Multi-Head Self-Attention + FFN); each sublayer wrapped with residual + LayerNorm; BERT-style.\nDecoder: N layers of (Masked Self-Attention + Cross-Attention + FFN); causal masking prevents attending to future tokens; GPT-style.\nPositional encoding: sinusoidal (fixed) or learned; RoPE (rotary position embedding) in LLaMA/GPT-NeoX—relative position via rotation.\nFFN: two linear layers with GELU/SwiGLU activation; dimension 4× model dim; accounts for ~2/3 of parameters.\nResidual stream: information flows through skip connections; each layer adds delta to residual stream.\nLayer normalization: pre-norm (before attention) more stable than post-norm; RMSNorm (LLaMA) drops mean subtraction.\nScaling laws: performance ∝ N^0.076 (parameters) × D^0.095 (data); Chinchilla law: optimal tokens ≈ 20× parameters.',
  },
  bert_pretraining_nlp: {
    summary: 'BERT pretrains a bidirectional transformer on masked language modeling and next sentence prediction, then fine-tunes on downstream tasks with a task-specific head.',
    explanation: 'MLM (Masked Language Model): randomly mask 15% of tokens; predict masked token (80% [MASK], 10% random, 10% unchanged); bidirectional context.\nNSP (Next Sentence Prediction): classify if sentence B follows sentence A; later found less useful (RoBERTa removes it).\nFine-tuning: add task head (linear classifier on [CLS], span predictor for QA); fine-tune all parameters; few epochs sufficient.\nRoBERTa: BERT + longer training + more data + no NSP + dynamic masking; consistently outperforms BERT.\nAlBERT: factorize embedding matrix (reduces params); cross-layer parameter sharing; sentence order prediction.\nDeBERTa: disentangled attention (content + position separately); virtual adversarial training; top results on SuperGLUE.\nBERT variants: SciBERT (science text), BioBERT (biomedical), mBERT (multilingual 104 languages).',
  },
  text_classification_nlp: {
    summary: 'Text classification assigns predefined categories to text; modern approaches fine-tune pretrained LMs, while zero-shot methods use natural language inference or prompt-based classification.',
    explanation: 'Multi-class (softmax): mutually exclusive classes (e.g., sentiment: pos/neg/neutral); fine-tune BERT with [CLS] → linear layer.\nMulti-label (sigmoid): multiple labels per document (e.g., news topics); independent binary classifiers.\nHierarchical: coarse-to-fine label taxonomy; hierarchical softmax or constraint-aware loss.\nZero-shot NLI: frame classification as entailment (MNLI-trained model); "This text is about sports" as hypothesis.\nPrompt-based: GPT-style in-context learning; "[text] Sentiment: "; few-shot with 16 examples often matches fine-tuned.\nImbalance handling: class weights, oversampling (SMOTE), focal loss; threshold tuning for precision/recall.\nEvaluation: accuracy (balanced datasets), macro-F1 (imbalanced), AUROC (ranking quality).',
  },
  named_entity_recognition: {
    summary: 'NER identifies and classifies named entities (persons, organizations, locations) in text; modern approaches use transformer-based sequence labeling with BIO tagging or span extraction.',
    explanation: 'BIO tagging: B-PER (begin person), I-PER (inside person), O (outside); linear-chain CRF on top of BERT emissions captures tag dependencies.\nSpan-based: enumerate all spans, classify each; handles overlapping entities; SopaNER, BERT-MRC.\nNested NER: "Bank of China" (ORG) contains "China" (LOC); span-based required; ACE 2005 benchmark.\nZero/few-shot NER: in-context learning with GPT-4; instruction-tuned models handle new entity types without fine-tuning.\nDomain adaptation: general NER models (OntoNotes) vs domain-specific (clinical NER with i2b2); domain shift is significant.\nCRF (Conditional Random Field): globally normalizes sequence probability; captures B→I constraint; Viterbi decoding.\nEvaluation: entity-level F1 (exact span match); span partial credit variants; CoNLL-2003 benchmark (PER/ORG/LOC/MISC).',
  },
  machine_translation_nlp: {
    summary: 'Neural machine translation uses encoder-decoder transformers trained on parallel corpora; BLEU score measures n-gram overlap with reference translations.',
    explanation: 'Seq2seq: encoder reads source → context → decoder generates target token by token; attention weights align source-target.\nTransformer NMT: Vaswani et al. 2017; multi-head cross-attention replaces alignment model; trained with label smoothing.\nBeam search: maintain B hypotheses; expand each with top tokens; select highest log-probability completed sequence; B=4-5 typical.\nBLEU: geometric mean of n-gram precision (1-4) × brevity penalty; fast but correlates poorly with human judgments at high scores.\nChrF, COMET: character-level F-score (morphology-friendly); COMET uses reference + source with neural model; better human correlation.\nLow-resource MT: backtranslation (translate target→source pseudo-parallel data); multilingual models (mBART, NLLB) share representations.\nNMT challenges: rare words, domain shift, named entities, code-switching; post-editing reduces human effort.',
  },
  question_answering_nlp: {
    summary: 'Question answering extracts or generates answers from context; extractive QA finds answer spans (SQuAD), while generative QA produces free-form answers using seq2seq models.',
    explanation: 'Extractive QA: encode [CLS] Q [SEP] context [SEP]; predict start/end token positions; BERT achieves human-level on SQuAD 1.1.\nSQuAD 2.0: includes unanswerable questions; model must predict "no answer" when context lacks answer.\nOpen-domain QA: dense retrieval (DPR—dual encoder) → BM25/FAISS → reader; DrQA, ORQA pipeline.\nGenerative QA: T5/GPT as reader; can generate answers not in context; better for complex reasoning.\nMulti-hop QA: HotpotQA requires combining information from multiple paragraphs; chain-of-thought helps.\nTruth verification (NLI): FEVER fact verification; classify claims as supported/refuted/not-enough-info.\nRAG integration: retrieve relevant passages → augment LLM context → generate grounded answer; reduces hallucination.',
  },
  text_generation_nlp: {
    summary: 'Language models generate text autoregressively by predicting the next token; sampling strategies (temperature, top-p, top-k) balance quality and diversity.',
    explanation: 'Autoregressive: P(x₁,...,xₙ) = ∏P(xₜ|x₁,...,x_{t-1}); decode token by token; causal mask in transformer.\nGreedy decoding: argmax at each step; fast but repetitive and suboptimal globally.\nBeam search: BxV candidates at each step; keeps top-B; more coherent but less diverse than sampling.\nTemperature sampling: divide logits by T; T<1 sharpens (more focused), T>1 flattens (more random); T=1 = true distribution.\nTop-k: sample from k most probable tokens; k=50 common; top-p (nucleus): sample from smallest set with cumulative prob ≥ p.\nRepetition penalty: penalize recently generated tokens; needed for long-form generation.\nSpeculative decoding: small draft model proposes tokens; large model verifies in parallel; 2-4× speedup at same quality.',
  },
  sentiment_analysis_nlp: {
    summary: 'Sentiment analysis classifies the emotional polarity (positive/negative/neutral) of text; aspect-based SA identifies sentiment toward specific entities or attributes.',
    explanation: 'Document-level: classify overall sentiment; BERT fine-tuned on SST-2 achieves 95%+ accuracy.\nAspect-based (ABSA): "great food but slow service"—food(+), service(−); aspect term extraction + polarity classification.\nOpinion triplet extraction: (aspect, opinion word, sentiment) simultaneously; table-filling or generative approaches.\nEmotions: Ekman 6 basic emotions; GoEmotions (27 categories); multi-label classification.\nDomain shift: reviews vs tweets vs news have different distributions; domain-adaptive pretraining helps.\nSarcasm/irony detection: "Wow, great service (not)"—contextual cues; requires world knowledge.\nLexicon-based: VADER for social media (rule-based); SentiWordNet; combine with neural for interpretability.',
  },
  information_extraction_nlp: {
    summary: 'Information extraction automatically structures unstructured text into entities, relations, and events; joint extraction models identify all components simultaneously.',
    explanation: 'Relation extraction: classify relation between entity pair in sentence (e.g., "born-in", "employs"); TACRED, DocRED benchmarks.\nPipeline vs joint: pipeline (NER → RE) propagates errors; joint models (SpERT, REBEL) train NER+RE simultaneously.\nEvent extraction: identify event triggers + arguments; ACE 2005 event ontology; template-filling approach.\nOpen IE: extract (subject, predicate, object) triples without predefined schema; OpenIE, ReVerb; noisier but broad coverage.\nCoreference resolution: link mentions of same entity ("Obama ... he ... the president"); SpanBERT-based models.\nDocumental-level: cross-sentence entities/relations; ATLOP, DocRE-BERT; longer context handling.\nKnowledge base population (KBP): scale IE to entire web; slot filling for entities; TAC KBP evaluation.',
  },
  dependency_parsing_nlp: {
    summary: 'Dependency parsing builds a tree showing grammatical relationships between words; arc-eager transition-based parsing is O(n), while graph-based methods consider all arc scores globally.',
    explanation: 'Universal Dependencies (UD): cross-lingual annotation scheme; 130+ languages; head = governor, dependent, relation label.\nTransition-based (arc-eager): stack + buffer + action set (SHIFT, LEFT-ARC, RIGHT-ARC, REDUCE); O(n); bi-LSTM/BERT features.\nGraph-based (Biaffine): score all possible arcs with biaffine classifier; MST (Edmonds algorithm) to extract tree; more accurate globally.\nCross-lingual: multilingual BERT enables zero-shot transfer to new languages; UD treebank training.\nConstituency parsing: phrase structure trees (NP, VP); CYK algorithm; Berkeley neural parser uses chart parsing with BERT.\nApplications: information extraction, question answering, machine translation (syntax-aware MT).\nEvaluation: UAS (unlabeled attachment score), LAS (labeled); computed per sentence and micro-averaged.',
  },
  knowledge_graphs_nlp: {
    summary: 'Knowledge graphs store structured facts as (entity, relation, entity) triples; embedding methods (TransE, RotatE) learn vector representations for link prediction and entity alignment.',
    explanation: 'KG construction: entity extraction + coreference + relation extraction from text; or crowdsourced (Wikidata, Freebase).\nTransE: entity embedding h + relation r ≈ tail t; loss penalizes ||h+r-t||; simple but struggles with 1-to-N relations.\nRotatE: relation as rotation in complex space; captures symmetry, inversion, composition patterns.\nKGBERT: KG triples as text; BERT scores plausibility; bridges symbolic and neural.\nEntity linking: "Apple announced..." → Apple Inc. in Wikidata; bi-encoder retrieval + cross-encoder reranking.\nQuestion answering over KG: KGQA; map question to SPARQL or neural embedding traversal; FreebaseQA, WebQuestions.\nKG completion: predict missing triples; evaluation: hits@10, MRR on FB15k-237, WN18RR.',
  },
  speech_recognition_asr: {
    summary: 'Automatic speech recognition converts audio to text; modern end-to-end models (Whisper, wav2vec 2.0) learn directly from audio spectrograms using self-supervised pretraining.',
    explanation: 'Traditional pipeline: MFCCs → acoustic model (HMM-GMM) → decoder (language model + lexicon); still used in embedded systems.\nCTC (Connectionist Temporal Classification): many-to-one alignment; collapses repeated tokens and blank; no alignment needed during training.\nseq2seq with attention: encoder reads mel spectrogram → decoder generates text; Listen Attend Spell (LAS); sensitive to long audio.\nWav2vec 2.0: CNN + transformer; self-supervised contrastive pretraining; fine-tune with CTC on 1-hour labeled data; outperforms supervised baselines.\nWhisper: 680K hours of weakly supervised multilingual data; encoder-decoder transformer; robust to accents, noise; state-of-the-art for most languages.\nEvaluation: WER (word error rate) = (S+D+I)/N; CER for character-level; DISFLUENCY-WER for conversational speech.\nStreaming ASR: streaming transducers (RNN-T); buffer audio chunks; latency vs accuracy tradeoff.',
  },
  dialogue_systems_nlp: {
    summary: 'Dialogue systems enable multi-turn conversations; task-oriented systems (booking, FAQ) use dialogue state tracking, while open-domain chatbots use generative language models.',
    explanation: 'Task-oriented: NLU (intent detection + slot filling) → DST (dialogue state tracking) → policy → NLG; TOD-BERT fine-tuned for each module.\nDialogue state: structured representation of user goals (hotel: area=center, stars=4); MultiWOZ benchmark (7 domains).\nEnd-to-end: SimpleTOD, PPTOD; single model predicts belief state + system response; chain-of-thought format.\nOpen-domain (chit-chat): retrieval-based (response selection from candidates); generative (GPT/LLaMA with RLHF).\nRetrieval-augmented dialogue: retrieve knowledge snippets → condition response; wizard-of-wikipedia.\nSafety: harmful/offensive output filtering; Constitutional AI; preference-based fine-tuning (DPO).\nEvaluation: task-oriented: goal success rate, turn count, entity F1; chit-chat: human preference, engagement, perplexity.',
  },
  multimodal_nlp: {
    summary: 'Multimodal models align vision and language representations; CLIP learns shared image-text embeddings via contrastive learning, enabling zero-shot classification and cross-modal retrieval.',
    explanation: 'CLIP: encode image (ViT) and text (transformer) independently; maximize cosine similarity of matching pairs; 400M pairs; powerful zero-shot.\nCLIP zero-shot classification: embed class names as text; cosine distance from image embedding; no task-specific training.\nFlamingo: cross-attention between frozen LM layers and visual features; few-shot multimodal reasoning.\nLLaVA / GPT-4V: visual tokens projected into LLM embedding space; instruction-tuned for multimodal QA and reasoning.\nDALL-E / Stable Diffusion: text-conditioned image generation; CLIP embedding guides diffusion; CLIP score measures alignment.\nVideo-language: CLIP4Clip, VideoCLIP for video retrieval; temporal aggregation of frame features.\nGrounding: GLIP, Grounding DINO; phrase-region alignment with detection backbone; phrase-grounded detection.',
  },
  llm_alignment_nlp: {
    summary: 'LLM alignment trains models to follow instructions and avoid harmful outputs; RLHF optimizes against a human preference reward model, while DPO simplifies this with direct preference optimization.',
    explanation: 'SFT (Supervised Fine-Tuning): fine-tune on human-curated (prompt, response) pairs; teaches instruction-following format.\nRLHF: train reward model on human preference pairs → optimize LLM with PPO (RL) to maximize reward; InstructGPT, ChatGPT.\nPPO challenges: reward hacking, KL penalty to stay near reference; unstable training; compute-intensive.\nDPO (Direct Preference Optimization): reparameterize reward in terms of policy; optimize preference objective directly without separate RM; simpler, equally effective.\nConstitutional AI (CAI): model critiques and revises own responses using a constitution of principles; Anthropic approach.\nKTO (Kahneman-Tversky Optimization): unpaired preference data; prospect theory-inspired; works without preference pairs.\nRed-teaming: adversarial prompting to find jailbreaks; automated red-teaming with LLMs; RL-based attack generation.',
  },
  rag_nlp: {
    summary: 'Retrieval-Augmented Generation (RAG) reduces hallucination by retrieving relevant documents at query time and providing them as context to the LLM before generating an answer.',
    explanation: 'Pipeline: embed query → ANN search in vector DB → retrieve top-k chunks → prepend to LLM prompt → generate.\nChunking strategy: fixed-size (512 tokens) vs semantic (sentence/paragraph); sliding window with overlap; chunk size affects recall/noise tradeoff.\nDense retrieval: bi-encoder (BERT-based) embeds query+docs independently; FAISS/Hnswlib for ANN search; DPR, BGE, E5.\nSparse retrieval: BM25 keyword matching; fast, interpretable, no embedding; hybrid (dense+sparse) best of both.\nReranking: cross-encoder scores query-document pairs; more accurate than bi-encoder; apply to top-100 from retrieval, return top-5.\nHyDE (Hypothetical Document Embedding): generate hypothetical answer → embed → retrieve; improves recall for abstractive queries.\nEvaluation: RAGAS framework; faithfulness (answer grounded in context), answer relevance, context precision/recall.',
  },
  prompt_engineering_nlp: {
    summary: 'Prompt engineering designs inputs to elicit desired LLM behavior; chain-of-thought prompting improves reasoning by instructing the model to show its work step by step.',
    explanation: 'Zero-shot: direct question without examples; works for simple tasks with instruction-tuned models.\nFew-shot (in-context learning): 3-16 examples in prompt; format: "Q: ... A: ..."; selection and ordering matter.\nChain-of-thought (CoT): "Let\'s think step by step" or manual reasoning traces; enables multi-step arithmetic and logical reasoning.\nSelf-consistency: sample multiple CoT chains; majority vote on final answer; reduces variance.\nTree-of-Thoughts: explore reasoning paths as a tree; backtrack from dead ends; better for search problems.\nReAct: interleave reasoning + actions (tool calls, search); grounded reasoning with real-world feedback.\nPrompt injection attacks: malicious input overrides system prompt; sandbox sensitive tool calls; prompt hardening techniques.',
  },
  // ── IOT & EDGE ─────────────────────────────────────────────────
  mqtt_protocol_iot: {
    summary: 'MQTT is a lightweight publish-subscribe messaging protocol for IoT; devices publish to topics, brokers route to subscribers, with configurable QoS levels for delivery guarantees.',
    explanation: 'Architecture: clients connect to broker (Mosquitto, EMQX, AWS IoT Core); publisher sends to topic; broker fans out to all subscribers.\nTopic hierarchy: "home/bedroom/temperature"; wildcard + (single level), # (multi-level); retained messages store last value.\nQoS 0: at-most-once (fire-and-forget). QoS 1: at-least-once (ACK, may duplicate). QoS 2: exactly-once (4-way handshake).\nMQTT v5: user properties, message expiry, shared subscriptions, reason codes; significant improvement over v3.1.1.\nLast Will and Testament: broker publishes predefined message when client disconnects unexpectedly; status monitoring.\nSecurity: TLS/mTLS for transport; JWT/OAuth2 for auth; ACL for topic permissions; avoid plain TCP in production.\nScaling: EMQX clusters to millions of concurrent connections; MQTT-SN variant for constrained (no TCP) devices.',
  },
  zigbee_zwave_iot: {
    summary: 'Zigbee and Z-Wave are low-power mesh networking protocols for smart home automation; Zigbee uses IEEE 802.15.4 at 2.4GHz, while Z-Wave operates at sub-1GHz for better wall penetration.',
    explanation: 'Zigbee (802.15.4): 2.4GHz globally; 250 Kbps; mesh with coordinator + routers + end devices; up to 65K nodes.\nZ-Wave: 868/908MHz (sub-GHz); better building penetration; up to 4-hop mesh; 232 nodes/network; proprietary interoperability certification.\nMesh routing: source routing (Zigbee NWK layer); AODV-like route discovery; router devices extend coverage.\nZigbee clusters: ZCL (Cluster Library) defines standard device profiles (smart energy, home automation, ZHA/ZLL).\nThread: IPv6-based mesh (IETF RFC); CoAP + DTLS; used by Matter protocol; OpenThread by Google.\nMatter (formerly CHIP): application layer over Thread/WiFi/Ethernet; Amazon, Apple, Google, Samsung aligned; launch 2022.\nPairing/commissioning: install code QR scan or NFC touch; network key distribution; secure join.',
  },
  lorawan_lpwan_iot: {
    summary: 'LoRaWAN uses LoRa spread-spectrum modulation for long-range (10-15 km), ultra-low-power IoT communications; devices send infrequent uplinks to gateways connected to a network server.',
    explanation: 'LoRa physical layer: CSS (Chirp Spread Spectrum) modulation; SF (spreading factor) 7-12 trades range vs data rate (250bps-50kbps).\nLoRaWAN network: end device → gateway (dumb forwarder) → network server (LoRa NS, deduplication) → application server.\nDevice classes: A (receive after uplink only, lowest power), B (scheduled receive windows), C (always listening, highest power).\nADR (Adaptive Data Rate): network adjusts SF and TX power based on SNR history; maximizes capacity.\nSecurity: NwkSKey (network encryption) + AppSKey (payload encryption); OTAA join procedure with DevEUI/AppKey.\nFrequency plans: EU868, US915, AS923; duty cycle limits (1% in EU) restrict uplink frequency.\nApplications: smart metering, asset tracking, smart agriculture; battery life 5-10 years on AA cells.',
  },
  edge_inference_iot: {
    summary: 'Edge inference runs ML models on constrained devices (MCUs, SBCs) near the data source; TFLite and ONNX Runtime provide optimized runtimes with quantization and hardware acceleration.',
    explanation: 'TensorFlow Lite: flatbuffer model format; interpreter with XNNPACK/GPU delegate; supports 8-bit quantization; runs on Raspberry Pi, Android.\nONNX Runtime: framework-agnostic; optimization passes (graph fusion, layout transforms); DirectML/CUDA/OpenVINO execution providers.\nQuantization: INT8 (weights + activations); reduces model size 4× and latency 2-4×; post-training quantization (PTQ) or QAT.\nPruning: remove low-magnitude weights; structured pruning (channel) vs unstructured; combine with quantization.\nHardware accelerators: Coral Edge TPU (4 TOPS), Hailo-8 (26 TOPS), Jetson Nano GPU; compiler toolchains generate optimized code.\nModel selection: MobileNetV3, EfficientLite, NanoDet; accuracy-latency tradeoff on target hardware (MLPerf Tiny).\nOn-device training: federated learning on device; TFLite micro training for personalization.',
  },
  ota_updates_iot: {
    summary: 'OTA (Over-the-Air) firmware updates allow remote device maintenance; A/B partition schemes enable atomic updates with rollback, while secure boot ensures only signed firmware runs.',
    explanation: 'A/B (dual-bank) partition: device has two firmware slots; update writes inactive slot; atomically switch on reboot; fail-safe rollback.\nDelta OTA: binary diff (bsdiff, xdelta) between versions; reduces download size 80-95%; critical for bandwidth-limited devices.\nSecure boot chain: ROM bootloader verifies SPL → SPL verifies bootloader → bootloader verifies kernel; each stage checks signature.\nFirmware signing: RSA/ECDSA signature over firmware binary; device stores public key in OTP/eFuse; verified before flash.\nOTA protocols: HTTPS with certificate pinning; MQTT/CoAP for constrained devices; LwM2M FOTA (IPSO standard).\nRollout strategy: staged rollout (canary 1% → 10% → 100%); health metrics gate progression; auto-rollback on error spike.\nPlatforms: Mender, Balena, AWS IoT Jobs, Eclipse Hawkbit; handle fleet management + rollout control.',
  },
  iot_security_basics: {
    summary: 'IoT security requires device authentication, encrypted communications, and secure provisioning; many IoT devices are compromised due to hardcoded credentials, unencrypted protocols, and lack of update mechanisms.',
    explanation: 'Threat model: physical access to device, network eavesdropping, cloud API attacks, supply chain compromise.\nDevice identity: X.509 certificates burned at manufacturing; TPM 2.0 stores keys in hardware; prevents key extraction.\nMTLS: mutual TLS authenticates both device and cloud; short-lived certificates via EST protocol.\nNetwork segmentation: IoT VLAN separate from corporate; firewall blocks inbound connections; outbound allow-list.\nCommon vulnerabilities: telnet/SSH with default passwords (Mirai botnet); unencrypted MQTT; no firmware update; debug interfaces left open.\nPSA (Platform Security Architecture): Arm security model; Root of Trust, secure storage, attestation, crypto API.\nOWASP IoT Top 10: weak passwords, insecure network services, insecure ecosystem interfaces, lack of secure update; use as checklist.',
  },
  digital_twin_iot: {
    summary: 'A digital twin is a virtual replica of a physical asset that receives real-time sensor data, enables simulation, and supports predictive maintenance and optimization.',
    explanation: 'Architecture: physical asset → IoT sensors → ingestion pipeline → digital twin model → analytics/simulation.\nAzure Digital Twins: DTDL (Digital Twin Definition Language) defines models; graph of twins mirrors physical system hierarchy.\nAWS IoT TwinMaker: integrates with S3, Timestream, Grafana; scene composer for 3D visualization.\nPredictive maintenance: anomaly detection on twin state; train ML on historical failure patterns; alert before breakdown.\nSimulation: run what-if scenarios on twin without affecting physical; parameter optimization; safety analysis.\nSynchronization latency: near real-time (1-5s) for monitoring; historical data for simulation; edge caching for slow links.\nChallenges: model fidelity, sensor calibration drift, data quality, twin lifecycle management.',
  },
  industrial_iot_protocols: {
    summary: 'Industrial IoT uses specialized protocols for reliability and real-time control; OPC-UA provides a unified information model, Modbus is legacy-compatible, and PROFINET enables deterministic Ethernet.',
    explanation: 'Modbus RTU/TCP: master-slave; simple register read/write (coils, discrete inputs, holding/input registers); 40-year-old standard; still ubiquitous in SCADA.\nOPC-UA (Unified Architecture): publish-subscribe + client-server; data model with types, references, events; security with X.509; IEC 62541.\nPROFINET: real-time Ethernet for PLC-IO communication; IRT (isochronous real-time) <1ms cycle; PROFIBUS successor.\nEtherNet/IP: EtherNet-based CIP (Common Industrial Protocol); used in Allen-Bradley PLCs; TCP for explicit, UDP for implicit (I/O).\nMQTT-S/SparkplugB: MQTT with standardized payload schema for SCADA/historian integration; Ignition SCADA.\nTSN (Time-Sensitive Networking): IEEE 802.1Q extensions; precise clock sync (802.1AS = gPTP); priority queuing; deterministic Ethernet.\nISA-95: enterprise-control integration model; levels 0-4; MES/ERP to control system data exchange.',
  },
  sensor_fusion_iot: {
    summary: 'Sensor fusion combines data from multiple sensors to estimate state more accurately than any single sensor; Kalman filtering is the optimal estimator for linear Gaussian systems.',
    explanation: 'Kalman filter: predict state with motion model → update with measurement; optimal for linear system + Gaussian noise; two matrices: P (covariance), K (gain).\nExtended KF: linearize nonlinear models via Jacobian; good for moderate nonlinearity; may diverge with large nonlinearity.\nUnscented KF: sigma points represent distribution; propagate through nonlinear function; more accurate than EKF.\nParticle filter: Monte Carlo; represent distribution as weighted samples; handles highly nonlinear/non-Gaussian; expensive for high-dimensional state.\nIMU+GPS fusion: dead-reckoning with IMU between GPS fixes; tight coupling improves reliability during GPS outage.\nLiDAR+Camera fusion: project LiDAR points to image; fuse depth + texture; PointPainting, TransFusion.\nComplementary filter: IMU gyroscope (short-term) + accelerometer/magnetometer (long-term) for attitude; simpler than KF; used in drones.',
  },
  tinyml_edge: {
    summary: 'TinyML deploys ML models on microcontrollers (MCUs) with kilobytes of RAM; quantization, pruning, and model architecture choices enable useful inference in <1 mW average power.',
    explanation: 'Target hardware: ARM Cortex-M4 (STM32, nRF52); 256KB flash, 64KB RAM typical; no OS or barebones RTOS.\nTF Micro (TFLite for Microcontrollers): C++ interpreter; 20KB runtime; op subset; no dynamic memory; fixed tensors.\nCMSIS-NN: ARM-optimized kernels (SIMD via DSP instructions); 4× speedup vs naive C; int8 dot-product operations.\nEdge Impulse: cloud tool for data collection, training, deployment; generates C++ SDK for any MCU.\nModel compression techniques: weight sharing, mixed precision, structured pruning + fine-tuning; targets <100KB model.\nKeyword spotting (KWS): canonical TinyML application; DS-CNN model; 98% accuracy on "yes/no" in 20KB.\nAnomalous sound detection: always-on MCU microphone; detect machine faults acoustically; sub-1mW with duty cycling.',
  },
  fog_computing_iot: {
    summary: 'Fog computing extends cloud capabilities to the network edge, processing IoT data locally to reduce latency, bandwidth, and cloud costs while enabling real-time decisions.',
    explanation: 'Fog vs edge: fog is intermediary (gateway/local server); edge is on-device; cloud is centralized; latency: cloud>fog>edge.\nOffloading decision: compute-intensive tasks (ML inference, video analytics) offloaded to fog/cloud; latency-sensitive kept at edge.\nFog node: industrial PC, edge server, or powerful gateway (NUC, Jetson); runs containers (K3s/MicroK8s).\nFog orchestration: OpenFog Consortium architecture; CloudFoundry, KubeEdge extends Kubernetes to edge.\nData reduction: filter, aggregate, and compress sensor data at fog before cloud upload; reduces bandwidth 10-100×.\nLatency: fog achieves 5-20ms vs cloud 50-200ms; suitable for real-time control loops (conveyor belt, traffic light).\nResilience: fog continues operating when cloud unreachable; local decision-making; sync when reconnected.',
  },
  energy_harvesting_iot: {
    summary: 'Energy harvesting collects ambient energy (solar, thermal, RF, vibration) to power IoT sensors without batteries, enabling truly maintenance-free perpetual operation.',
    explanation: 'Solar: amorphous silicon cells (low-light indoor), monocrystalline (outdoor); MPPT circuit maximizes power extraction; supercapacitor buffer.\nThermoelectric: Peltier/Seebeck effect; ΔT between heat source and ambient; milliwatts from industrial pipes; boost converter to usable voltage.\nVibration (piezoelectric): resonant frequency matching; MEMS vibration harvesters; 100µW at 1g vibration; PVDF polymer films.\nRF harvesting: rectenna antenna + rectifier; harvest from ambient WiFi/cellular; nanowatts to microwatts; near-field (WPT) up to milliwatts.\nPower management: ultra-low quiescent LDO; sub-threshold MCU (nRF52810); energy-aware scheduling; duty cycling to µA average.\nSupercapacitor: 1-10F buffer; fast charge/discharge; lower energy density than LiPo but millions of cycles.\nIntermittent computing: compute in bursts when energy available; checkpoint state to NVM; transactional memory models.',
  },
  time_sensitive_networking: {
    summary: 'Time-Sensitive Networking (TSN) extends standard Ethernet with IEEE 802.1Q amendments to provide deterministic, low-latency communications for industrial automation and automotive networks.',
    explanation: 'IEEE 802.1AS (gPTP): precision time protocol over Ethernet; sub-microsecond synchronization; grandmaster clock selected by BMCA.\nIEEE 802.1Qbv (TAS—Time-Aware Shaper): scheduled traffic gates open/close at precise times; hard latency bounds for critical streams.\nIEEE 802.1Qav (CBS—Credit-Based Shaper): AVB audio/video; credits accumulate during idle; smooth burst shaping.\nIEEE 802.1CB: frame replication and elimination; redundant paths for high availability; eliminates single-point-of-failure.\nTSN configuration: CNC (Centralized Network Configuration) / CUC (Centralized User Configuration); NETCONF/YANG management plane.\nAutomotive: AUTOSAR Adaptive + TSN for zonal architecture; replaces FlexRay/CAN in high-bandwidth domains.\nIndustrial: TSN + OPC-UA converged network; single Ethernet for IT+OT; Siemens, Cisco, Intel implementations.',
  },
  matter_protocol_iot: {
    summary: 'Matter is a royalty-free, IP-based smart home protocol developed by the CSA (formerly Zigbee Alliance) to enable interoperability across Apple HomeKit, Google Home, Amazon Alexa, and Samsung SmartThings.',
    explanation: 'Transport: IPv6 over WiFi, Thread (mesh), or Ethernet; uses CoAP application protocol; DTLS 1.3 security.\nThread integration: Matter devices on Thread form a mesh; Border Router (Apple HomePod, Google Nest Hub) bridges to IP.\nDevice types: standardized data models for light, lock, thermostat, sensor; each device type has defined clusters.\nCommissioning: QR code scan via fabric initiator (phone); secure channel established; device joins fabric.\nFabric: each controller (Apple, Google, Amazon) is a fabric; multi-fabric allows one device in multiple ecosystems.\nController: local control for low latency; no cloud required for basic operation; Matter controller app (Apple Home, Google Home).\nMatter SDK: open-source (GitHub connectedhomeip); reference implementations; chip-tool for testing.',
  },
  cellular_iot_nbiot: {
    summary: 'NB-IoT and LTE-M are 3GPP cellular standards for IoT; NB-IoT optimizes for ultra-low power and deep coverage, while LTE-M supports voice, mobility, and higher data rates.',
    explanation: 'NB-IoT (Cat-NB): 200 kHz narrow band; max 250 kbps DL; deep indoor penetration (+20 dB vs LTE); deployment in GSM/LTE guard band.\nLTE-M (Cat-M1): 1.4 MHz; 1 Mbps; supports VoLTE, mobility (handover); suitable for wearables, asset tracking.\nPSM (Power Saving Mode): device goes dormant after transmission; wakes on timer or network page; battery life years.\neDRX (Extended Discontinuous Reception): paging cycle up to 10.24s; device sleeps between paging windows.\n5G NR IoT: RedCap (Reduced Capability) for industrial sensors; URLLC for deterministic latency; mMTC for massive connectivity.\nSIM/eSIM: eSIM remotely provisionable; eUICC standard; MNO switching without physical swap; critical for global deployments.\nCoverage: NB-IoT deployed in 60+ countries; roaming agreements for global asset tracking; alternative to satellite for coverage gaps.',
  },
  // ── COMPLEX SYSTEMS ────────────────────────────────────────────
  network_theory_complex: {
    summary: 'Complex network theory analyzes real-world networks (social, biological, internet) as graphs; small-world networks have short average paths with high clustering, while scale-free networks have power-law degree distributions.',
    explanation: 'Small-world (Watts-Strogatz): regular lattice + random shortcuts; high clustering C (like lattice) + short path length L (like random); 6 degrees of separation.\nScale-free (Barabási-Albert): preferential attachment growth; degree distribution P(k) ~ k^(-γ); hubs highly connected; robust to random failure, fragile to hub attack.\nErdős-Rényi random graph: each edge exists with probability p; Poisson degree distribution; phase transition at p=1/n (giant component emerges).\nCentrality: degree (local influence), betweenness (bridge/broker), closeness (reach speed), eigenvector/PageRank (recursive importance).\nCommunity detection: Louvain (modularity maximization), Girvan-Newman (edge betweenness removal); overlapping communities (OSLOM).\nRobustness: percolation threshold; fraction of nodes to remove to disconnect giant component; scale-free vulnerable to targeted attack.\nApplications: epidemiology (SIR model on network), protein interaction networks, internet topology, social influence.',
  },
  emergence_complex_systems: {
    summary: 'Emergence describes global patterns arising from local interactions; self-organization produces ordered structures (flocking, ant colonies) without central control through simple rules.',
    explanation: 'Weak emergence: macroscopic property in principle reducible to micro interactions (temperature = mean KE); epistemological emergence.\nStrong emergence: property irreducible to components; consciousness as claimed example; controversial ontological claim.\nFlocking (Reynolds Boids): 3 rules—separation, alignment, cohesion; realistic flocking from local neighbor interactions; no global coordination.\nAnt colony: stigmergy (pheromone trails); shortest-path finding; ACO (Ant Colony Optimization) algorithm for TSP, routing.\nPhysical self-organization: Bénard convection cells (heat → ordered rolls); reaction-diffusion patterns (Turing patterns—stripes, spots).\nCritical slowing down: near phase transition, system recovers slowly from perturbation; early warning signal for tipping points.\nArtificial life: Conway\'s Game of Life; emergent computation; universal computation in cellular automata Rule 110.',
  },
  agent_based_modeling: {
    summary: 'Agent-based models (ABMs) simulate systems by defining simple agent rules and observing emergent population-level dynamics; used in epidemiology, economics, ecology, and urban planning.',
    explanation: 'Agents: autonomous entities with state + behavior rules; interact with other agents and environment; no central controller.\nNetLogo: educational ABM platform; built-in spatial environment; breeds (agent types); widely used in social science.\nMesa (Python): flexible ABM framework; grid/network schedulers; visualization via Solara; better for large-scale models.\nSchelling segregation model: agents prefer neighbors of same type; even weak preference leads to strong segregation; famous emergent result.\nEpidemic models: SIR (susceptible, infected, recovered) on network; heterogeneous agent types; intervention policies tested in silico.\nAgent rationality: bounded rationality (Herbert Simon); satisficing; BDI (belief-desire-intention) agents; game-theoretic agents.\nCalibration/validation: fit agent parameters to real data; out-of-sample validation; sensitivity analysis (Sobol indices).',
  },
  game_theory_complex: {
    summary: "Game theory analyzes strategic interactions among rational agents; Nash equilibrium defines stable outcomes where no player benefits from unilaterally deviating, while mechanism design engineers incentive structures.",
    explanation: 'Nash equilibrium: strategy profile where each player\'s strategy is best response to others; every finite game has at least one Nash equilibrium (mixed strategies).\nDominant strategy: best regardless of opponent actions; Prisoner\'s Dilemma—defect is dominant but leads to suboptimal outcome (dilemma).\nEvolutionary stable strategy (ESS): strategy that resists invasion by mutants; hawk-dove game; replicator dynamics.\nMechanism design (inverse game theory): design rules/incentives to achieve desired equilibrium; VCG mechanism; auction theory.\nCooperative games: coalitional value function; Shapley value fairly attributes contribution; used in AI explainability (SHAP).\nCorrelated equilibrium: players follow common randomization signal; broader than Nash; computationally tractable.\nPrice of anarchy: ratio of social welfare at Nash vs optimal; routing games (Braess paradox); quantifies efficiency loss of selfishness.',
  },
  evolutionary_dynamics: {
    summary: 'Evolutionary dynamics models how strategy frequencies change over time in populations; replicator equations describe selection, while mutation and drift introduce variation.',
    explanation: 'Replicator dynamics: ẋᵢ = xᵢ(fᵢ - f̄); frequency of strategy i grows if its fitness fᵢ exceeds mean f̄; continuous-time ODE.\nFitness landscape: maps genotype to fitness; peaks = local optima; NK model for tunable ruggedness.\nHawk-Dove game: equilibrium mix of aggressive (hawk) and passive (dove) strategies; ESS found when V/C = hawk frequency.\nPrice equation: change in mean trait = selection + transmission; unifies many models; Hamilton\'s inclusive fitness as special case.\nGenetic drift: random sampling in finite populations; Moran process; genetic drift dominates selection when Ns<<1.\nCultural evolution: meme transmission and selection; dual inheritance theory; gene-culture coevolution.\nEvolutionary game theory: strategies compete based on payoff matrix; rock-paper-scissors → non-equilibrium cycling dynamics.',
  },
  synchronization_complex: {
    summary: 'Synchronization in coupled oscillators describes how independent rhythms lock to a common frequency; the Kuramoto model shows a phase transition from incoherence to global synchrony as coupling increases.',
    explanation: 'Kuramoto model: dθᵢ/dt = ωᵢ + (K/N)∑ sin(θⱼ-θᵢ); order parameter r = |∑e^{iθⱼ}|/N; phase transition at K_c = 2/πg(0) (g = frequency distribution width).\nPhase locking: fireflies flashing in unison; pacemaker cells in heart; pendulum clocks on common shelf.\nChimera states: coexistence of synchronized and incoherent clusters in identical oscillator networks; surprising theoretical discovery (2002).\nCoupled limit cycles: Winfree, FitzHugh-Nagumo models; periodic solutions; phase response curve (PRC) characterizes perturbation sensitivity.\nNeural synchrony: gamma oscillations (40 Hz) in cortex; binding problem; epilepsy as pathological synchrony.\nPower grid: generators synchronize frequency; blackout cascade when synchrony lost; secondary frequency control.\nControl of synchronization: pinning control (drive subset of nodes); measure-and-feedback; desynchronization for epilepsy treatment.',
  },
  critical_phenomena_complex: {
    summary: 'Phase transitions and critical phenomena occur when systems abruptly change state; at the critical point, power-law correlations and universality classes emerge, independent of microscopic details.',
    explanation: 'Order parameter: quantity that is zero in disordered phase, nonzero in ordered phase (magnetization, superfluid density).\nCritical exponents: correlation length ξ ~ |T-Tc|^{-ν}; specific heat ~ |T-Tc|^{-α}; magnetization ~ (Tc-T)^β; universal within universality class.\nUniversality class: systems with same symmetry + dimensionality share critical exponents; Ising 2D, Ising 3D, XY model are different classes.\nRenormalization group (RG): Kadanoff block spin → integrate out short wavelength → flow in parameter space; fixed point = critical point.\nIsing model: spins ±1 on lattice; H = -J∑sᵢsⱼ - h∑sᵢ; exact solution in 2D (Onsager); mean-field in high dimensions.\nSelf-organized criticality (SOC): systems naturally evolve to critical state without tuning; sandpile model, Bak-Tang-Wiesenfeld; power-law avalanches.\nApplications: social tipping points, financial crashes, ecosystem collapse; early warning signals (rising variance, autocorrelation).',
  },
  information_theory_complex: {
    summary: 'Information theory quantifies information, entropy, and channel capacity; Shannon entropy H(X) = -∑p(x)log₂p(x) provides the fundamental limit for lossless compression.',
    explanation: 'Shannon entropy: H(X) = -∑p log₂p bits; maximum for uniform distribution; measures uncertainty/information content.\nJoint entropy H(X,Y); conditional H(X|Y) = H(X,Y)-H(Y); mutual information I(X;Y) = H(X)-H(X|Y) = shared information.\nChannel capacity C = max_{P(X)} I(X;Y); Shannon-Hartley: C = B log₂(1+SNR) bits/s; fundamental bandwidth-SNR tradeoff.\nSource coding theorem: lossless compression achievable at rate ≥ H(X); Huffman coding approaches entropy; arithmetic coding achieves it.\nChannel coding theorem: error-free communication at any rate < C; exists capacity-approaching codes (LDPC, turbo, polar).\nKolmogorov complexity: shortest program describing string; incompressible strings are random; uncomputable but theoretically fundamental.\nInformation in complex systems: transfer entropy (directed information flow), integrated information (Φ—consciousness measure), Fisher information (parameter estimation sensitivity).',
  },
  percolation_theory: {
    summary: 'Percolation theory studies connectivity in random media; a giant connected component emerges abruptly at the percolation threshold p_c—a phase transition relevant to epidemics, materials, and networks.',
    explanation: 'Bond percolation: each edge present with probability p; site percolation: each node present with probability p.\nPercolation threshold p_c: fraction of edges/nodes at which giant component first appears; p_c = 1/(z-1) for Bethe lattice (degree z).\nSquare lattice: p_c = 0.5 (bond), 0.593 (site); computed exactly or numerically via Monte Carlo.\nCluster size distribution: power law at p_c, exponential below; critical exponents same as Ising model (related universality).\nNetwork epidemics: SIR spreading → bond percolation with T = transmission probability; epidemic threshold = 1/<k²>/<k> for heterogeneous networks.\nForest fires: trees ignite neighbors; percolation controls fire spread; optimize logging to keep forest below p_c.\nConnected components: union-find (DSU) algorithm; Hoshen-Kopelman for labeling; Newman-Ziff algorithm for efficient threshold finding.',
  },
  cellular_automata: {
    summary: "Cellular automata (CA) are discrete computational models where cells update based on neighbor states; Conway's Game of Life demonstrates Turing completeness and universal computation from simple rules.",
    explanation: "1D elementary CA: 3-cell neighborhood → 256 possible rules; Wolfram's classification: Class 1 (stable), 2 (periodic), 3 (chaotic), 4 (complex/edge of chaos).\nRule 110: Class 4; proven Turing complete; supports gliders, guns, annihilators.\nConway's Game of Life: 2D; birth (3 live neighbors), survival (2-3), death; Turing complete; still/periodic/glider patterns.\nGliders: propagating structures; glider guns; universal computation via collision interactions.\nLangton's Ant: 2-state Turing machine on 2D grid; seemingly random then emergent highway structure.\nReaction-diffusion CA: Turing patterns; Gray-Scott model; spots, stripes, spirals from two-chemical interaction.\nApplications: traffic flow (Nagel-Schreckenberg), crystal growth, galaxy formation simulation, crowd dynamics.",
  },
  // ── MISC CS ───────────────────────────────────────────────────
  randomized_algorithms: {
    summary: 'Randomized algorithms use random choices to achieve simplicity or expected efficiency; Las Vegas algorithms always return correct answers, Monte Carlo algorithms may err but are fast.',
    explanation: 'Las Vegas: always correct, random running time; QuickSort (random pivot), randomized min-cut; expected complexity stated.\nMonte Carlo: bounded error probability; run k times to amplify success probability to 1-δ; polynomial identity testing (Schwartz-Zippel).\nQuickSort expected O(n log n): random pivot ensures balanced splits in expectation; O(n²) worst case eliminated with overwhelming probability.\nRandomized min-cut (Karger): contract random edges; O(n²) iterations give min-cut with high probability.\nBloom filter: hash-based probabilistic set membership; false positive rate ε; size m = -n ln ε / (ln 2)²; no false negatives.\nSkip list: probabilistic balanced BST; O(log n) expected; random levels per node; simpler implementation than red-black.\nHashing: universal hash families; 2-universal → collision probability 1/m; cuckoo hashing for O(1) worst-case lookup.',
  },
  byzantine_fault_tolerance: {
    summary: 'Byzantine Fault Tolerance (BFT) enables distributed consensus even when some nodes behave arbitrarily or maliciously; BFT requires 3f+1 total nodes to tolerate f Byzantine failures.',
    explanation: 'Byzantine generals: n generals reach consensus on attack/retreat; f traitors may send conflicting messages; solvable iff n≥3f+1.\nPBFT (Practical BFT): 3-phase protocol (pre-prepare, prepare, commit); O(n²) message complexity; 10K TPS possible; used in Hyperledger.\nHotStuff: linear message complexity O(n) via BLS threshold signatures; pipelined commits; Libra/DiemBFT basis.\nTendermint: BFT consensus + PoS; lock-step rounds; validator set; finality in one block; Cosmos blockchain.\nView change: remove faulty leader; n-2f correct nodes trigger view change; safety maintained during leadership transition.\nThreshold signatures: BLS aggregation; n nodes generate n secret shares; any t+1 reconstruct signature; eliminates leader bottleneck.\nBlockchain relevance: permissioned blockchains use BFT; permissionless use PoW/PoS as Sybil resistance + economic BFT.',
  },
  blockchain_distributed: {
    summary: 'Blockchain is a distributed ledger of cryptographically linked blocks; Proof-of-Work achieves probabilistic Nakamoto consensus, while Proof-of-Stake selects validators by stake for energy efficiency.',
    explanation: 'Block structure: header (prev hash, merkle root, timestamp, nonce) + transaction list; SHA-256 hash links blocks; immutability by cost of recomputation.\nPoW (Bitcoin): find nonce such that SHA256(block) < target; difficulty adjusts every 2016 blocks; 51% attack requires majority hashrate.\nMerkle tree: hash binary tree over transactions; Merkle proof in O(log n) shows inclusion without full block; SPV clients use this.\nProof-of-Stake (Ethereum post-merge): validators stake 32 ETH; randomly selected proportional to stake; slashing penalizes equivocation.\nSmart contracts (EVM): Turing-complete bytecode on Ethereum; gas limits compute; Solidity/Vyper languages; DeFi, NFTs, DAOs.\nLayer 2: rollups (Optimistic, ZK-rollup) batch transactions off-chain; only post state root to L1; 10-1000× throughput improvement.\nTrilemma: decentralization, security, scalability—current systems sacrifice one; research focus on sharding, ZK-proofs.',
  },
  explainable_ai_xai: {
    summary: 'Explainable AI methods help interpret model predictions; SHAP assigns feature contributions based on cooperative game theory, while LIME fits a local linear surrogate around each prediction.',
    explanation: 'SHAP (SHapley Additive exPlanations): assigns each feature a Shapley value = average marginal contribution over all coalitions; satisfies efficiency, symmetry, dummy, additivity axioms.\nTreeSHAP: exact polynomial-time SHAP for tree models; O(TLD²) where T=trees, L=leaves, D=depth; integrated in XGBoost, LightGBM.\nLIME: perturb input → sample predictions → fit weighted linear model locally; explain single prediction; model-agnostic; can be unstable.\nGrad-CAM: class activation map via gradients of target class w.r.t. final conv feature maps; backprop to localize important image regions.\nIntegrated Gradients: accumulate gradients along straight path from baseline to input; satisfies completeness axiom; faithful attribution.\nConceptual explanations: TCAV (concept activation vectors); test sensitivity to human-defined concepts.\nRegulatory: EU AI Act requires explanations for high-risk AI; GDPR right to explanation; XAI critical for medical/financial models.',
  },
  model_compression_quantization: {
    summary: 'Model compression reduces neural network size and inference latency; quantization converts weights to lower precision (INT8), pruning removes unnecessary connections, and distillation trains small student models to mimic large teachers.',
    explanation: 'Post-training quantization (PTQ): calibrate activation ranges on representative data; quantize to INT8; <1% accuracy drop for most vision models.\nQuantization-aware training (QAT): simulate quantization during training with fake quantize ops; straight-through estimator for gradients; best accuracy retention.\nGPTQ: one-shot weight quantization for LLMs; layer-wise Hessian-based rounding; 4-bit quantization of 175B GPT with <1% perplexity increase.\nPruning: magnitude pruning (remove low-|w| weights); structured (channel/head/layer); lottery ticket hypothesis; unstructured needs sparse hardware.\nKnowledge distillation: student network trained on teacher soft outputs (soft labels carry inter-class similarity); DistilBERT 40% smaller, 97% BERT performance.\nLow-rank factorization: decompose weight matrix W ≈ UV^T with r << min(m,n); SVD-based; LoRA applies this for efficient LLM fine-tuning.\nNAS + compression co-design: Once-for-All (OFA), Hardware-aware NAS; find Pareto-optimal models per target device.',
  },
  continual_learning_ml: {
    summary: 'Continual learning trains on sequential tasks without forgetting previously learned knowledge; catastrophic forgetting occurs when new training overwrites old weights—mitigated by regularization, replay, or modular architectures.',
    explanation: 'Catastrophic forgetting: neural networks overwrite old task weights when trained on new task; gradient interference in shared parameters.\nEWC (Elastic Weight Consolidation): add penalty λ∑Fᵢ(θᵢ-θ*ᵢ)²; Fisher information Fᵢ weights importance of each parameter; penalizes changing important weights.\nProgressive Neural Networks: freeze old task columns, add new column with lateral connections; no forgetting but linear parameter growth.\nExperience replay: store subset of old task data; replay during new task training; GEM (Gradient Episodic Memory) ensures no gradient interference.\nPackNet: iteratively prune + fix old task parameters; new task uses remaining capacity; forward transfer but zero backward.\nTask-incremental vs class-incremental: task-IL (task ID given at test) easier; class-IL (no task ID) harder; realistic scenario.\nEvaluation: backward transfer (forgetting old tasks), forward transfer (benefit from pretraining), average accuracy across tasks.',
  },
  synthetic_data_generation: {
    summary: 'Synthetic data generation creates artificial training data to augment real datasets, overcome privacy constraints, or address class imbalance; GANs and diffusion models produce photorealistic synthetic images.',
    explanation: 'Data augmentation: geometric (flip, crop, rotate), color jitter, Mixup (blend two samples), CutMix (paste crop); cheapest form of synthesis.\nGAN-based: StyleGAN for face synthesis; conditional GAN (class-conditional or text-conditional); discriminator ensures realism.\nDiffusion-based: stable diffusion with text prompts; domain-specific fine-tuning (DreamBooth, LoRA); photorealistic, controllable.\nTabular synthesis: CTGAN (conditional GAN for tabular), TVAEs; preserve marginal/joint distributions; TSTR evaluation (train synth, test real).\nPrivacy: synthetic data can still leak; membership inference on generative model; evaluate with differential privacy guarantees.\nMedical imaging: GAN-synthesized CT/MRI augments rare pathology datasets; domain randomization for sim-to-real transfer in robotics.\nEvaluation: FID (fidelity vs real), IS (Inception Score), TSTR/TRTS; downstream task performance on synthetic-trained model.',
  },
  formal_languages_automata: {
    summary: 'Formal language theory classifies languages by computational complexity; regular languages are recognized by finite automata, context-free by pushdown automata, and recursively enumerable by Turing machines.',
    explanation: 'Chomsky hierarchy: regular (Type 3) ⊂ context-free (Type 2) ⊂ context-sensitive (Type 1) ⊂ recursively enumerable (Type 0).\nDFA: deterministic finite automaton; states + transitions + accept states; recognizes regular language; closure under union/intersection/complement.\nNFA to DFA: subset construction; exponential blowup worst case (but often polynomial); equivalent expressive power.\nRegular expressions: Kleene star, concatenation, union; equivalent to DFA/NFA (Kleene theorem); practical regex engines (PCRE) add backreferences (not regular).\nPumping lemma for regular: for long strings w in L, w=xyz where |y|≥1 and xyⁿz∈L; proves language non-regular.\nCFG + pushdown automata: CYK algorithm parses CFG in O(n³); Earley parser for general CFG; LL(1)/LR(1) for efficient parsing.\nContext-sensitive / recursively enumerable: linear-bounded automata / Turing machines; Church-Turing thesis.',
  },
  computability_theory: {
    summary: 'Computability theory defines the limits of algorithmic computation; the halting problem is undecidable, meaning no Turing machine can determine for all programs whether they terminate.',
    explanation: 'Turing machine: infinite tape, read/write head, state machine; computation model; Church-Turing thesis: all reasonable computation models are equivalent.\nHalting problem: given (program P, input I), determine if P(I) halts; proven undecidable by diagonalization (Turing 1936).\nDiagonalization: assume decider H exists; construct D that halts iff H says non-halting; D(D) creates contradiction; undecidability follows.\nReduction: if A reduces to B and B decidable then A decidable; contrapositive: A undecidable + A ≤_m B → B undecidable.\nRice\'s theorem: any non-trivial semantic property of programs is undecidable; e.g., "does P output 42?" is undecidable.\nRecursively enumerable (RE): semi-decidable; Turing machine halts and accepts if x∈L; may loop on x∉L; RE ∩ co-RE = decidable.\nArithmetic hierarchy: Σ₁ (RE), Π₁ (co-RE), Δ₁ (decidable); higher levels via alternating quantifiers; Post\'s theorem links to oracle TMs.',
  },

};
