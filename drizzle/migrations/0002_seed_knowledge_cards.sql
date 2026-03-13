-- Seed knowledge_cards from GRAPH_NODES (577 cards)
-- Generated at: 2026-03-10T09:16:31.094Z
-- Data-only migration (no schema changes).
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
  ('graph_mathematics', $__KC__$Mathematics$__KC__$, $__KC__$concept in Mathematics$__KC__$, $__KC__$Domain: Mathematics
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Mathematics$__KC__$, 'other', 'memorize'),
  ('graph_computer_science', $__KC__$Computer Science$__KC__$, $__KC__$concept in Computer Science$__KC__$, $__KC__$Domain: Computer Science
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Computer_Science$__KC__$, 'info', 'memorize'),
  ('graph_machine_learning', $__KC__$Machine Learning$__KC__$, $__KC__$concept in Machine Learning$__KC__$, $__KC__$Domain: Machine Learning
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Machine_Learning$__KC__$, 'ml', 'memorize'),
  ('graph_artificial_intelligence', $__KC__$Artificial Intelligence$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Artificial_Intelligence$__KC__$, 'ml', 'memorize'),
  ('graph_linear_algebra', $__KC__$Linear Algebra$__KC__$, $__KC__$The study of vector spaces, linear maps, and systems of linear equations$__KC__$, $__KC__$Core tools: matrix multiplication, eigendecomposition, SVD.
Foundation for PCA, Kalman filter, neural-network weight updates, and most of ML.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Linear_Algebra$__KC__$, 'other', 'understand'),
  ('graph_vector_spaces', $__KC__$Vector Spaces$__KC__$, $__KC__$A set closed under vector addition and scalar multiplication (satisfying 8 axioms)$__KC__$, $__KC__$Basis: minimal spanning set. dim(V) = # basis vectors.
R^n, polynomials, and matrices are all vector spaces.
Key: every element is a unique linear combination of basis vectors.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Vector_Spaces$__KC__$, 'other', 'understand'),
  ('graph_matrix_multiplication', $__KC__$Matrix Multiplication$__KC__$, $__KC__$C = AB where C_{ij} = Σ_k A_{ik}B_{kj}; represents composition of linear maps$__KC__$, $__KC__$NOT commutative: AB ≠ BA in general. Associative: (AB)C = A(BC).
If A is m×k and B is k×n, C is m×n. Naive O(n³); Strassen O(n^{2.81}).
Dot-product view: C_{ij} = row_i(A) · col_j(B).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Matrix_Multiplication$__KC__$, 'other', 'understand'),
  ('graph_eigenvalues_eigenvectors', $__KC__$Eigenvalues & Eigenvectors$__KC__$, $__KC__$Av = λv: eigenvector v is only scaled (not rotated) by matrix A; λ is the eigenvalue$__KC__$, $__KC__$Find λ: det(A − λI) = 0 (characteristic polynomial).
Diagonalization: A = P D P^{−1}, D = diag(λ₁,…,λₙ).
Applications: PCA, Markov chain steady state, stability analysis, Google PageRank.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Eigenvalues_%26_Eigenvectors$__KC__$, 'other', 'connect'),
  ('graph_svd', $__KC__$Singular Value Decomposition$__KC__$, $__KC__$A = UΣV^T: any matrix factors into rotation × scaling × rotation$__KC__$, $__KC__$U (m×m), V (n×n) orthogonal; Σ diagonal with σ₁ ≥ σ₂ ≥ … ≥ 0.
Rank-k approximation: keep top-k singular values → best low-rank approx (Eckart-Young).
Found: PCA, pseudoinverse, latent semantic analysis, recommender systems.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Singular_Value_Decomposition$__KC__$, 'other', 'apply'),
  ('graph_matrix_inverse', $__KC__$Matrix Inverse$__KC__$, $__KC__$A^{-1} such that AA^{-1} = I; exists iff det(A) ≠ 0$__KC__$, $__KC__$In practice: NEVER compute A^{-1} explicitly — use LU factorization to solve Ax = b.
2×2: [[d, -b], [-c, a]] / (ad-bc). Condition number κ = σ_max/σ_min measures numerical stability.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Matrix_Inverse$__KC__$, 'other', 'understand'),
  ('graph_determinant', $__KC__$Determinant$__KC__$, $__KC__$Scalar measuring the signed volume scaling of the linear transformation A$__KC__$, $__KC__$det(A) = 0 ↔ A singular (columns linearly dependent).
det(AB) = det(A)·det(B). det(A^T) = det(A). Negative det → reflection.
For 2×2: ad − bc. For n×n: cofactor expansion or LU product of pivots.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Determinant$__KC__$, 'other', 'understand'),
  ('graph_linear_transformations', $__KC__$Linear Transformations$__KC__$, $__KC__$Map T: V → W preserving addition T(u+v)=T(u)+T(v) and scaling T(αv)=αT(v)$__KC__$, $__KC__$Every linear map on R^n is matrix multiplication: T(x) = Ax.
Kernel (null space) + Image (column space) characterize the map.
Rank-Nullity: dim(ker T) + dim(im T) = dim(V).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Linear_Transformations$__KC__$, 'other', 'connect'),
  ('graph_orthogonality', $__KC__$Orthogonality$__KC__$, $__KC__$Two vectors u, v are orthogonal when their dot product u·v = 0$__KC__$, $__KC__$Orthonormal basis: {q_i} where q_i·q_j = δ_{ij}.
QR decomposition: A = QR (via Gram-Schmidt).
Projection onto subspace W: P = QQ^T. Minimizes distance ||b − Pb||.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Orthogonality$__KC__$, 'other', 'connect'),
  ('graph_least_squares', $__KC__$Least Squares$__KC__$, $__KC__$Minimizes ||Ax − b||² when the system is overdetermined (more equations than unknowns)$__KC__$, $__KC__$Normal equations: A^T Ax = A^T b → x* = (A^T A)^{-1} A^T b.
Geometrically: projects b onto col(A).
Used in linear regression, curve fitting, signal processing.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Least_Squares$__KC__$, 'other', 'connect'),
  ('graph_matrix_factorization', $__KC__$Matrix Factorization$__KC__$, $__KC__$Decomposing a matrix into a product of simpler matrices (LU, QR, SVD, Cholesky, etc.)$__KC__$, $__KC__$LU: A = LU for triangular solve (O(n³)). QR: for least squares & eigenvalues.
SVD: A = UΣV^T most general. Cholesky: A = LL^T for positive definite.
Choice depends on problem structure and numerical properties.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Matrix_Factorization$__KC__$, 'other', 'connect'),
  ('graph_positive_definite_matrices', $__KC__$Positive Definite Matrices$__KC__$, $__KC__$Symmetric A such that x^T Ax > 0 for all nonzero x$__KC__$, $__KC__$Equivalent conditions: all eigenvalues > 0; all leading minors > 0; Cholesky exists.
Arises naturally in covariance matrices, Hessians at minima, Gram matrices K_{ij} = ⟨x_i, x_j⟩.
Positive semi-definite (PSD): ≥ 0 (allows zero eigenvalues).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Positive_Definite_Matrices$__KC__$, 'other', 'connect'),
  ('graph_norm', $__KC__$Norm$__KC__$, $__KC__$A function ‖·‖ measuring vector magnitude: non-negative, zero iff v=0, homogeneous, triangle inequality$__KC__$, $__KC__$L1: Σ|x_i|  L2: √(Σx_i²)  L∞: max|x_i|  Lp: (Σ|x_i|^p)^{1/p}.
L1 promotes sparsity; L2 is Euclidean distance.
Matrix norms: Frobenius ‖A‖_F = √(ΣΣa_{ij}²), spectral = σ_max.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Norm$__KC__$, 'other', 'understand'),
  ('graph_probability_statistics', $__KC__$Probability & Statistics$__KC__$, $__KC__$The mathematics of uncertainty, random phenomena, and inference from data$__KC__$, $__KC__$Core concepts: probability distributions, expectation, variance, Bayes theorem.
Foundation for all of machine learning, signal processing, and scientific inference.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Probability_%26_Statistics$__KC__$, 'other', 'understand'),
  ('graph_random_variables', $__KC__$Random Variables$__KC__$, $__KC__$A function X: Ω → R mapping outcomes to real numbers; described by its distribution$__KC__$, $__KC__$Discrete: PMF P(X=x). Continuous: PDF f(x), CDF F(x) = P(X≤x).
E[X] = Σx·P(x) or ∫x·f(x)dx. Var(X) = E[X²] − (E[X])².
Joint: P(X,Y); marginal by summing/integrating out the other variable.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Random_Variables$__KC__$, 'other', 'understand'),
  ('graph_expectation', $__KC__$Expectation$__KC__$, $__KC__$E[X] = Σx·P(x) or ∫x·f(x)dx — the probability-weighted average value$__KC__$, $__KC__$Linearity: E[aX+bY] = aE[X] + bE[Y] (always, even if dependent).
E[g(X)] ≠ g(E[X]) in general (Jensen inequality: equal for linear g).
E[XY] = E[X]E[Y] only if X, Y independent.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Expectation$__KC__$, 'other', 'understand'),
  ('graph_variance', $__KC__$Variance$__KC__$, $__KC__$Var(X) = E[(X−μ)²] = E[X²] − (E[X])² — measures spread around the mean$__KC__$, $__KC__$Var(aX+b) = a²Var(X). Var(X+Y) = Var(X)+Var(Y) if X,Y uncorrelated.
Std dev σ = √Var(X) is in the same units as X.
Sample variance: s² = Σ(x_i−x̄)²/(n−1) (Bessel correction for unbiasedness).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Variance$__KC__$, 'other', 'understand'),
  ('graph_bayes_theorem', $__KC__$Bayes Theorem$__KC__$, $__KC__$P(A|B) = P(B|A)·P(A) / P(B) — the rule for inverting conditional probabilities$__KC__$, $__KC__$Posterior ∝ Likelihood × Prior.
Total probability: P(B) = Σ_i P(B|A_i)P(A_i).
Foundation of Bayesian inference: update prior belief with observed evidence.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bayes_Theorem$__KC__$, 'other', 'connect'),
  ('graph_maximum_likelihood_estimation', $__KC__$Maximum Likelihood Estimation$__KC__$, $__KC__$θ̂_MLE = argmax_θ ∏ p(x_i|θ) — find parameters that make observed data most probable$__KC__$, $__KC__$Maximize log-likelihood ℓ(θ) = Σ log p(x_i|θ) (numerically stable, same argmax).
Gaussian: MLE → sample mean and variance. Categorical: MLE → empirical frequencies.
MLE for classification loss = cross-entropy minimization.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Maximum_Likelihood_Estimation$__KC__$, 'other', 'connect'),
  ('graph_conditional_probability', $__KC__$Conditional Probability$__KC__$, $__KC__$P(A|B) = P(A∩B)/P(B) — probability of A given that B is known to have occurred$__KC__$, $__KC__$Chain rule: P(A∩B) = P(A|B)·P(B).
Independence: P(A|B) = P(A) ↔ P(A∩B) = P(A)P(B).
Conditional expectation E[X|Y] is the foundation of all probabilistic models.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Conditional_Probability$__KC__$, 'other', 'understand'),
  ('graph_probability_distributions', $__KC__$Probability Distributions$__KC__$, $__KC__$A function specifying how probabilities are assigned to outcomes of a random variable$__KC__$, $__KC__$Discrete: Bernoulli(p), Binomial(n,p), Poisson(λ), Geometric.
Continuous: Normal N(μ,σ²), Exponential(λ), Beta, Gamma.
Characterized by moments (mean, variance, skewness) and moment-generating function.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Probability_Distributions$__KC__$, 'other', 'understand'),
  ('graph_gaussian_distribution', $__KC__$Gaussian Distribution$__KC__$, $__KC__$X ~ N(μ, σ²): symmetric bell curve; the most natural distribution by the Central Limit Theorem$__KC__$, $__KC__$PDF: (1/σ√2π) exp(−(x−μ)²/2σ²). Standard: Z = (X−μ)/σ ~ N(0,1).
68-95-99.7 rule: ±1σ, ±2σ, ±3σ cover those percentages.
Max-entropy distribution for fixed mean and variance.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Gaussian_Distribution$__KC__$, 'other', 'understand'),
  ('graph_law_of_large_numbers', $__KC__$Law of Large Numbers$__KC__$, $__KC__$The sample mean X̄_n converges to the true mean μ as n → ∞$__KC__$, $__KC__$Weak LLN: P(|X̄_n − μ| > ε) → 0. Strong LLN: X̄_n → μ almost surely.
Requires finite mean. Basis for Monte Carlo: (1/N)Σf(x_i) → E[f(X)].
Frequency interpretation of probability: P(A) = lim n(A)/n.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Law_of_Large_Numbers$__KC__$, 'other', 'connect'),
  ('graph_central_limit_theorem', $__KC__$Central Limit Theorem$__KC__$, $__KC__$√n(X̄_n − μ)/σ → N(0,1) as n→∞, for i.i.d. samples with finite variance$__KC__$, $__KC__$Sum of n i.i.d. RVs → Gaussian regardless of original distribution.
Requires: finite variance and independence (or weak dependence).
Explains ubiquity of normal distribution; enables confidence intervals and hypothesis tests.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Central_Limit_Theorem$__KC__$, 'other', 'connect'),
  ('graph_covariance', $__KC__$Covariance$__KC__$, $__KC__$Cov(X,Y) = E[(X−μ_X)(Y−μ_Y)] — measures linear co-variation between two variables$__KC__$, $__KC__$Cov(X,X) = Var(X). Correlation ρ = Cov(X,Y)/(σ_X σ_Y) ∈ [−1,1].
Covariance matrix Σ_{ij} = Cov(X_i, X_j): symmetric, positive semi-definite.
Independent → Cov=0, but Cov=0 does NOT imply independence.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Covariance$__KC__$, 'other', 'understand'),
  ('graph_hypothesis_testing', $__KC__$Hypothesis Testing$__KC__$, $__KC__$Statistical procedure to decide between null H₀ and alternative H₁ using sample data$__KC__$, $__KC__$p-value = P(data at least as extreme | H₀ true). Reject H₀ if p < α.
Type I error: false reject (rate = α). Type II error: false accept (rate = β).
Power = 1−β. t-test, χ² test, ANOVA are common instances.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Hypothesis_Testing$__KC__$, 'other', 'connect'),
  ('graph_bayesian_inference', $__KC__$Bayesian Inference$__KC__$, $__KC__$Update prior P(θ) with likelihood P(data|θ) → posterior P(θ|data) ∝ P(data|θ)P(θ)$__KC__$, $__KC__$Conjugate priors give closed-form posteriors (Beta-Binomial, Normal-Normal).
MCMC (Metropolis-Hastings, HMC) for intractable posteriors.
Credible interval: P(θ ∈ CI | data) = 95%, vs frequentist confidence interval.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bayesian_Inference$__KC__$, 'other', 'apply'),
  ('graph_map_estimation', $__KC__$MAP Estimation$__KC__$, $__KC__$θ̂_MAP = argmax P(θ|data) = argmax [log P(data|θ) + log P(θ)] — posterior mode$__KC__$, $__KC__$MAP = MLE + log-prior regularizer.
Gaussian prior → L2 regularization (Ridge). Laplace prior → L1 (Lasso).
Point estimate: richer information in full posterior, but MAP is faster.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/MAP_Estimation$__KC__$, 'other', 'connect'),
  ('graph_markov_chains', $__KC__$Markov Chains$__KC__$, $__KC__$Stochastic process where the future depends only on the present: P(X_{t+1}|X_t, X_{t-1},…) = P(X_{t+1}|X_t)$__KC__$, $__KC__$Transition matrix T where T_{ij} = P(X→j | X=i).
Stationary distribution π: πT = π. Detailed balance: π_i T_{ij} = π_j T_{ji}.
Foundation of MCMC, RL, Google PageRank, Hidden Markov Models.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Markov_Chains$__KC__$, 'other', 'connect'),
  ('graph_optimization', $__KC__$Optimization$__KC__$, $__KC__$Finding the minimum (or maximum) of an objective function, possibly subject to constraints$__KC__$, $__KC__$Unconstrained: ∇f(x*) = 0 (necessary); H ≻ 0 (sufficient for local min).
Constrained: KKT conditions generalize this. Convex → local min is global.
Core of all machine learning: training = solving an optimization problem.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Optimization$__KC__$, 'other', 'connect'),
  ('graph_gradient_descent', $__KC__$Gradient Descent$__KC__$, $__KC__$θ ← θ − α∇L(θ): iterate in the direction of steepest descent to minimize loss$__KC__$, $__KC__$Learning rate α: too large → diverge; too small → slow.
Convergence: O(1/k) for convex L, O(ρ^k) for strongly convex.
Full-batch GD uses all data; expensive per step but accurate gradient.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Gradient_Descent$__KC__$, 'other', 'connect'),
  ('graph_convex_optimization', $__KC__$Convex Optimization$__KC__$, $__KC__$Minimize f(x) over convex set C where f satisfies f(λx+(1−λ)y) ≤ λf(x)+(1−λ)f(y)$__KC__$, $__KC__$Key property: any local minimum is a global minimum.
Necessary and sufficient (unconstrained): ∇f(x*) = 0.
LP, QP, SDP are all convex. Many ML losses are convex (linear regression, logistic regression).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Convex_Optimization$__KC__$, 'other', 'apply'),
  ('graph_lagrange_multipliers', $__KC__$Lagrange Multipliers$__KC__$, $__KC__$Solve constrained min f(x) s.t. g(x)=0 by finding x where ∇f = λ∇g$__KC__$, $__KC__$Lagrangian L(x,λ) = f(x) + λg(x). Set ∂L/∂x = 0, ∂L/∂λ = 0.
λ is the shadow price (marginal cost) of the constraint.
Inequality constraints: KKT conditions (λ ≥ 0, λg(x)=0).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Lagrange_Multipliers$__KC__$, 'other', 'apply'),
  ('graph_duality', $__KC__$Duality$__KC__$, $__KC__$Primal (min f) ↔ Dual (max g), where g(λ) = min_x L(x,λ); dual provides lower bound$__KC__$, $__KC__$Weak duality: d* ≤ p*. Strong duality (Slater's condition): d* = p*.
Dual variables = shadow prices of constraints.
SVM dual: often easier to solve; kernelizes naturally.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Duality$__KC__$, 'other', 'apply'),
  ('graph_stochastic_gradient_descent', $__KC__$Stochastic Gradient Descent$__KC__$, $__KC__$Gradient estimated from a random mini-batch: θ ← θ − α∇L_{batch}(θ)$__KC__$, $__KC__$Mini-batch B: B=1 pure SGD, B=N full GD. Noise helps escape sharp minima.
Decreasing lr schedule (step / cosine / warmup) ensures convergence.
Faster than full GD per update; often generalizes better.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Stochastic_Gradient_Descent$__KC__$, 'other', 'connect'),
  ('graph_adam_optimizer', $__KC__$Adam Optimizer$__KC__$, $__KC__$Adaptive Moment Estimation: per-parameter lr combining momentum (m) and RMSProp (v)$__KC__$, $__KC__$m_t = β₁m_{t-1} + (1−β₁)g_t
v_t = β₂v_{t-1} + (1−β₂)g_t²
θ ← θ − α·(m̂_t / (√v̂_t + ε))  [bias-corrected]
Typical: β₁=0.9, β₂=0.999, α=1e-3. Default optimizer for deep learning.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Adam_Optimizer$__KC__$, 'other', 'connect'),
  ('graph_learning_rate', $__KC__$Learning Rate$__KC__$, $__KC__$Scalar α controlling step size in gradient descent: θ ← θ − α∇L$__KC__$, $__KC__$Too large → divergence or oscillation. Too small → slow convergence.
Schedules: step decay, cosine annealing, warmup then decay.
Adaptive methods (Adam, RMSProp) tune α per-parameter automatically.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Learning_Rate$__KC__$, 'other', 'understand'),
  ('graph_momentum', $__KC__$Momentum$__KC__$, $__KC__$Accumulate past gradients: v ← βv − α∇L, θ ← θ + v — accelerates training$__KC__$, $__KC__$Physical analogy: ball rolling downhill, building speed. β ≈ 0.9.
Reduces oscillations in high-curvature ravines; accelerates in low-curvature directions.
Nesterov momentum: compute gradient at the lookahead position → faster convergence.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Momentum$__KC__$, 'other', 'connect'),
  ('graph_loss_function', $__KC__$Loss Function$__KC__$, $__KC__$L(ŷ, y): scalar measure of discrepancy between prediction ŷ and true label y$__KC__$, $__KC__$Regression: MSE = (1/n)Σ(y−ŷ)², MAE = (1/n)Σ|y−ŷ|.
Classification: cross-entropy = −Σy·log(ŷ). Hinge (SVM): max(0, 1−y·f(x)).
Choice of loss determines what optimal prediction means.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Loss_Function$__KC__$, 'other', 'understand'),
  ('graph_cross_entropy_loss', $__KC__$Cross Entropy Loss$__KC__$, $__KC__$L = −Σ y_i log p_i: measures divergence between true labels y and predicted probabilities p$__KC__$, $__KC__$Binary: L = −[y log p + (1−y) log(1−p)].
Minimizing cross-entropy ≡ maximizing log-likelihood (MLE).
Numerically: use log-softmax + NLLLoss (LogSumExp trick avoids overflow).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Cross_Entropy_Loss$__KC__$, 'other', 'connect'),
  ('graph_calculus', $__KC__$Calculus$__KC__$, $__KC__$The mathematics of continuous change: differentiation (rates) and integration (accumulation)$__KC__$, $__KC__$Fundamental Theorem: differentiation and integration are inverse operations.
Key for gradient computation, probability density integration, and change-of-variables.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Calculus$__KC__$, 'other', 'understand'),
  ('graph_partial_derivatives', $__KC__$Partial Derivatives$__KC__$, $__KC__$∂f/∂x_i: rate of change of f w.r.t. x_i, holding all other variables constant$__KC__$, $__KC__$Gradient ∇f = [∂f/∂x_1, …, ∂f/∂x_n].
Second partials ∂²f/∂x_i∂x_j form the Hessian matrix.
Clairaut's theorem: mixed partials are equal when continuous.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Partial_Derivatives$__KC__$, 'other', 'understand'),
  ('graph_chain_rule', $__KC__$Chain Rule$__KC__$, $__KC__$d/dx f(g(x)) = f'(g(x))·g'(x) — the fundamental rule for differentiating compositions$__KC__$, $__KC__$Multivariate: ∂z/∂t = Σ_i (∂z/∂x_i)(∂x_i/∂t).
Backpropagation IS the chain rule applied recursively on computational graphs.
Essential for every gradient computation in deep learning.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chain_Rule$__KC__$, 'other', 'understand'),
  ('graph_taylor_expansion', $__KC__$Taylor Expansion$__KC__$, $__KC__$Polynomial approximation of f near x₀: f(x) ≈ f(x₀) + f'(x₀)(x−x₀) + f''(x₀)(x−x₀)²/2! + …$__KC__$, $__KC__$Error of degree-n approximation: O((x−x₀)^{n+1}).
Newton's method uses 2nd-order Taylor: x_{k+1} = x_k − H^{-1}∇f.
Key expansions: e^x = Σx^n/n!, sin x = x − x³/6 + …$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Taylor_Expansion$__KC__$, 'other', 'connect'),
  ('graph_gradient', $__KC__$Gradient$__KC__$, $__KC__$∇f(x) = [∂f/∂x_1, …, ∂f/∂x_n]^T — vector pointing in the direction of steepest ascent$__KC__$, $__KC__$‖∇f‖ = rate of steepest ascent. Gradient descent: move in −∇f.
Necessary condition for min/max: ∇f = 0.
Matrix calculus: ∂(Ax)/∂x = A^T, ∂(x^T Ax)/∂x = 2Ax (symmetric A).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Gradient$__KC__$, 'other', 'understand'),
  ('graph_jacobian', $__KC__$Jacobian$__KC__$, $__KC__$J_{ij} = ∂f_i/∂x_j: matrix of all first-order partial derivatives of a vector-valued function$__KC__$, $__KC__$|det(J)| = local volume scaling (change of variables in integration).
f: R^n → R^m → J is m×n.
Robotics: end-effector velocity = J · joint velocity. Critical for backprop through vector layers.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Jacobian$__KC__$, 'other', 'connect'),
  ('graph_hessian', $__KC__$Hessian$__KC__$, $__KC__$H_{ij} = ∂²f/(∂x_i ∂x_j): symmetric matrix of all second-order partial derivatives$__KC__$, $__KC__$H ≻ 0 ↔ strict local minimum. H ≺ 0 ↔ maximum. Indefinite → saddle point.
Newton's method: x_{k+1} = x_k − H^{-1}∇f.
Expensive: O(n²) storage, O(n³) invert. Quasi-Newton approximates it.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Hessian$__KC__$, 'other', 'connect'),
  ('graph_integration', $__KC__$Integration$__KC__$, $__KC__$∫f(x)dx: continuous summation — computes area under a curve or total accumulation$__KC__$, $__KC__$FTC: d/dx ∫_a^x f(t)dt = f(x).
Gaussian integral: ∫_{-∞}^{∞} e^{-x²}dx = √π.
In ML: computing expectations E[f(X)] = ∫f(x)p(x)dx; normalizing distributions.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Integration$__KC__$, 'other', 'understand'),
  ('graph_multivariable_calculus', $__KC__$Multivariable Calculus$__KC__$, $__KC__$Calculus extended to functions of multiple variables: gradients, Jacobians, Hessians, multiple integrals$__KC__$, $__KC__$Gradient, divergence, curl unify classical physics (Maxwell's equations).
Stokes' theorem generalizes the Fundamental Theorem of Calculus.
Key for optimization (∇f=0), density estimation (∫f=1), and backpropagation.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Multivariable_Calculus$__KC__$, 'other', 'connect'),
  ('graph_algorithms', $__KC__$Algorithms$__KC__$, $__KC__$Step-by-step computational procedures that solve problems with guaranteed correctness and efficiency$__KC__$, $__KC__$Analyze: time complexity T(n), space complexity S(n), correctness proof.
Design paradigms: divide-and-conquer, dynamic programming, greedy, backtracking.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Algorithms$__KC__$, 'info', 'understand'),
  ('graph_sorting', $__KC__$Sorting$__KC__$, $__KC__$Arrange elements in order; comparison-based lower bound is Ω(n log n)$__KC__$, $__KC__$Merge sort: O(n log n) stable, O(n) space. Quicksort: O(n log n) avg, O(n²) worst.
Heapsort: O(n log n) in-place. Counting/Radix: O(n) for bounded-range integers.
In-place vs. stable vs. parallelizable are key tradeoffs.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sorting$__KC__$, 'info', 'understand'),
  ('graph_dynamic_programming', $__KC__$Dynamic Programming$__KC__$, $__KC__$Solve overlapping subproblems once and cache results to avoid redundant computation$__KC__$, $__KC__$Requires: optimal substructure + overlapping subproblems.
Top-down: memoize recursive calls. Bottom-up: fill table iteratively.
Examples: LCS O(mn), 0/1 knapsack O(nW), shortest paths (Bellman-Ford, Floyd-Warshall).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Dynamic_Programming$__KC__$, 'info', 'connect'),
  ('graph_graph_algorithms', $__KC__$Graph Algorithms$__KC__$, $__KC__$Algorithms operating on graphs G=(V,E): traversal, shortest paths, spanning trees, connectivity$__KC__$, $__KC__$BFS: shortest path unweighted, O(V+E). DFS: cycle detection, topological sort.
Dijkstra: shortest path non-negative weights O((V+E)logV).
Bellman-Ford: handles negative edges O(VE). Floyd-Warshall: all-pairs O(V³).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Graph_Algorithms$__KC__$, 'info', 'connect'),
  ('graph_greedy_algorithms', $__KC__$Greedy Algorithms$__KC__$, $__KC__$Make the locally optimal choice at each step, achieving a global optimum when the greedy property holds$__KC__$, $__KC__$Works when: greedy-choice property + optimal substructure.
Examples that work: Huffman coding, Prim's/Kruskal's MST, activity selection, fractional knapsack.
DoesNOT always work: 0/1 knapsack, coin change with arbitrary denominations.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Greedy_Algorithms$__KC__$, 'info', 'understand'),
  ('graph_divide_and_conquer', $__KC__$Divide and Conquer$__KC__$, $__KC__$Split into sub-problems, solve recursively, combine: T(n) = aT(n/b) + f(n)$__KC__$, $__KC__$Master theorem: T(n) = Θ(n^{log_b a}) if f(n) = O(n^{log_b a − ε}).
Examples: merge sort T(n) = 2T(n/2)+O(n) = O(n log n). Strassen: O(n^{2.81}).
Naturally parallelizable. Basis of FFT: O(n log n) vs O(n²) DFT.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Divide_and_Conquer$__KC__$, 'info', 'understand'),
  ('graph_binary_search', $__KC__$Binary Search$__KC__$, $__KC__$Find target in sorted array in O(log n) by repeatedly halving the search space$__KC__$, $__KC__$Invariant: target ∈ [lo, hi]. Mid = lo + (hi−lo)//2 (avoids overflow).
Generalizes: find first x satisfying any monotone predicate.
Applications: search in sorted array, square root, minimize convex function on integers.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Binary_Search$__KC__$, 'info', 'memorize'),
  ('graph_bfs', $__KC__$Breadth-First Search$__KC__$, $__KC__$Explore graph level by level using a FIFO queue; finds shortest unweighted paths$__KC__$, $__KC__$O(V+E). Mark visited to avoid revisits.
BFS tree gives shortest-hop paths from source s.
Also: detects cycles (undirected), finds connected components, tests bipartiteness.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Breadth-First_Search$__KC__$, 'info', 'understand'),
  ('graph_dfs', $__KC__$Depth-First Search$__KC__$, $__KC__$Explore as deep as possible before backtracking using recursion or an explicit stack$__KC__$, $__KC__$O(V+E). Discovery/finish timestamps reveal graph structure.
Edge types: tree, back, forward, cross edges (directed DFS).
Applications: topological sort, SCC (Kosaraju/Tarjan), cycle detection, maze solving.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Depth-First_Search$__KC__$, 'info', 'understand'),
  ('graph_dijkstra', $__KC__$Dijkstra's Algorithm$__KC__$, $__KC__$Single-source shortest paths for graphs with non-negative edge weights using a priority queue$__KC__$, $__KC__$Greedy: repeatedly extract minimum-distance unvisited vertex.
O((V+E) log V) with binary heap; O(V log V + E) with Fibonacci heap.
Fails for negative edge weights → use Bellman-Ford.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Dijkstra's_Algorithm$__KC__$, 'info', 'connect'),
  ('graph_backtracking', $__KC__$Backtracking$__KC__$, $__KC__$Systematically search all candidates; abandon a partial solution as soon as it violates constraints$__KC__$, $__KC__$DFS + constraint-pruning. Incremental construction with feasibility check at each step.
Examples: N-Queens, Sudoku, subset-sum, permutations.
Pruning efficiency determines practical performance; often exponential worst-case.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Backtracking$__KC__$, 'info', 'connect'),
  ('graph_data_structures', $__KC__$Data Structures$__KC__$, $__KC__$Ways to organize and store data for efficient access, insertion, deletion, and modification$__KC__$, $__KC__$Core tradeoff: time vs. space, access patterns vs. update frequency.
Choose based on operations needed: search, insert, delete, order, range queries.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Data_Structures$__KC__$, 'info', 'understand'),
  ('graph_trees', $__KC__$Trees$__KC__$, $__KC__$Connected acyclic graph with one root; each node has a parent (except root) and zero or more children$__KC__$, $__KC__$Height-h binary tree has ≤ 2^h leaves. BST: O(h) search/insert/delete.
Balanced (AVL, Red-Black): O(log n) guaranteed. B-tree: minimizes disk I/O (page-aware).
In-order traversal of BST gives sorted sequence.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Trees$__KC__$, 'info', 'understand'),
  ('graph_hash_tables', $__KC__$Hash Tables$__KC__$, $__KC__$Map keys to values via a hash function; expected O(1) insert, lookup, and delete$__KC__$, $__KC__$Load factor α = n/m. Collision: chaining (linked lists) or open addressing (probing).
Universal hashing: E[collisions per key] = O(α). Resize at α > 0.7.
Worst case O(n), but expected O(1) with good hash function.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Hash_Tables$__KC__$, 'info', 'understand'),
  ('graph_heaps', $__KC__$Heaps$__KC__$, $__KC__$Complete binary tree satisfying the heap property: parent ≥ children (max-heap) or parent ≤ children (min-heap)$__KC__$, $__KC__$Insert: O(log n) sift-up. Extract-max: O(log n) sift-down. Build-heap: O(n).
Stored in array: children of node i are 2i+1 and 2i+2 (1-indexed).
Priority queue implementation. Heapsort: O(n log n), in-place.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Heaps$__KC__$, 'info', 'understand'),
  ('graph_graphs_ds', $__KC__$Graphs$__KC__$, $__KC__$G = (V, E): vertices connected by edges; directed or undirected, weighted or unweighted$__KC__$, $__KC__$Adjacency matrix: O(1) edge check, O(V²) space → dense graphs.
Adjacency list: O(degree) traversal, O(V+E) space → sparse graphs.
DAG (directed acyclic graph): key for dependencies, topological ordering.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Graphs$__KC__$, 'info', 'understand'),
  ('graph_linked_lists', $__KC__$Linked Lists$__KC__$, $__KC__$Linear sequence of nodes, each containing data and a pointer to the next node$__KC__$, $__KC__$O(1) insert/delete with pointer, O(n) search (no random access).
Doubly linked: O(1) delete with node reference. Singly: O(1) prepend.
Used in hash table chaining, LRU cache, undo history.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Linked_Lists$__KC__$, 'info', 'memorize'),
  ('graph_stacks_queues', $__KC__$Stacks & Queues$__KC__$, $__KC__$Stack (LIFO): push/pop from top. Queue (FIFO): enqueue at back, dequeue from front. Both O(1)$__KC__$, $__KC__$Stack applications: DFS, call frames, bracket matching, undo/redo.
Queue applications: BFS, scheduling, producer-consumer.
Deque: O(1) at both ends. Priority queue: ordered by priority (heap-backed).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Stacks_%26_Queues$__KC__$, 'info', 'memorize'),
  ('graph_binary_search_tree', $__KC__$Binary Search Tree$__KC__$, $__KC__$BST: left subtree < node < right subtree; enables O(h) search, insert, delete$__KC__$, $__KC__$In-order traversal gives sorted sequence. Successor = leftmost of right subtree.
Height h = O(log n) balanced, O(n) degenerate. Self-balancing: AVL, Red-Black O(log n).
AVL: |height_L − height_R| ≤ 1 at every node.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Binary_Search_Tree$__KC__$, 'info', 'understand'),
  ('graph_trie', $__KC__$Trie$__KC__$, $__KC__$Prefix tree where each path from root to leaf spells a key; O(L) operations, L = key length$__KC__$, $__KC__$Space: O(ALPHABET_SIZE × L × N). All operations: O(L).
Applications: autocomplete, spell check, IP routing, dictionary.
Compressed trie (Patricia tree) merges single-child nodes to save space.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Trie$__KC__$, 'info', 'connect'),
  ('graph_complexity_theory', $__KC__$Complexity Theory$__KC__$, $__KC__$The study of computational resources (time, space) required to solve problems$__KC__$, $__KC__$Classifies problems by inherent difficulty, independent of implementation.
Key classes: P, NP, NP-complete, NP-hard, PSPACE, EXP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Complexity_Theory$__KC__$, 'other', 'connect'),
  ('graph_big_o_notation', $__KC__$Big-O Notation$__KC__$, $__KC__$f(n) = O(g(n)): f grows no faster than c·g(n) for large n — asymptotic upper bound$__KC__$, $__KC__$O: upper, Ω: lower, Θ: tight, o: strict upper, ω: strict lower.
Hierarchy: O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2^n) < O(n!).
Always analyze worst-case unless stated otherwise.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Big-O_Notation$__KC__$, 'other', 'understand'),
  ('graph_p_vs_np', $__KC__$P vs NP$__KC__$, $__KC__$P: solvable in polynomial time. NP: verifiable in polynomial time. Is P = NP? Unknown.$__KC__$, $__KC__$P ⊆ NP. Most believe P ≠ NP (Millennium Prize Problem, $1M).
If P = NP: modern cryptography (RSA, AES) collapses; AI and optimization become trivial.
NP-hard ≥ hardest NP problems in difficulty (may not be in NP themselves).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/P_vs_NP$__KC__$, 'other', 'apply'),
  ('graph_np_completeness', $__KC__$NP-Completeness$__KC__$, $__KC__$NP-complete: a problem that is both in NP and NP-hard (hardest problems in NP)$__KC__$, $__KC__$Show NP-complete: prove in NP + reduce from known NP-complete problem.
First proven: CIRCUIT-SAT (Cook-Levin, 1971). Classic examples: 3-SAT, Clique, Vertex Cover, TSP, Knapsack.
Solve any NP-complete in polynomial time → P = NP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/NP-Completeness$__KC__$, 'other', 'apply'),
  ('graph_time_complexity', $__KC__$Time Complexity$__KC__$, $__KC__$How algorithm runtime grows as a function of input size n$__KC__$, $__KC__$Count primitive operations, not wall-clock seconds.
Common complexities: O(log n) binary search, O(n) scan, O(n log n) merge sort, O(n²) nested loops.
Worst-case vs average-case can differ dramatically (quicksort O(n log n) avg, O(n²) worst).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Time_Complexity$__KC__$, 'other', 'understand'),
  ('graph_space_complexity', $__KC__$Space Complexity$__KC__$, $__KC__$How algorithm memory usage grows as a function of input size n$__KC__$, $__KC__$Auxiliary space excludes input. O(1): in-place. O(n): linear extra. O(n²): matrix.
Recursion stack depth = O(depth). Memoization: O(states) space for O(states) time.
Space-time tradeoff: hash table gives O(1) time at O(n) space cost.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Space_Complexity$__KC__$, 'other', 'understand'),
  ('graph_supervised_learning', $__KC__$Supervised Learning$__KC__$, $__KC__$Learn a mapping f: X → Y from labeled training examples (x_i, y_i) pairs$__KC__$, $__KC__$Goal: minimize expected loss on unseen data (generalization).
Key concepts: overfitting, bias-variance tradeoff, cross-validation.
Algorithms: linear/logistic regression, SVM, trees, neural networks.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Supervised_Learning$__KC__$, 'ml', 'understand'),
  ('graph_linear_regression', $__KC__$Linear Regression$__KC__$, $__KC__$Fit a hyperplane y = Xβ + ε to minimize squared error ‖y − Xβ‖²$__KC__$, $__KC__$Closed form: β̂ = (X^T X)^{-1}X^T y (normal equations).
Assumes: linear relationship, i.i.d. Gaussian errors, no multicollinearity.
R² = 1 − SS_res/SS_tot measures fraction of variance explained.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Linear_Regression$__KC__$, 'ml', 'understand'),
  ('graph_logistic_regression', $__KC__$Logistic Regression$__KC__$, $__KC__$Binary classifier: P(y=1|x) = σ(w^T x + b), trained via cross-entropy loss$__KC__$, $__KC__$Log-odds (logit) = w^T x + b is linear. Decision boundary: w^T x + b = 0.
No closed form; solved via gradient descent (or Newton). Output is a probability.
Extends to softmax regression for multi-class classification.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Logistic_Regression$__KC__$, 'ml', 'connect'),
  ('graph_svm', $__KC__$Support Vector Machine$__KC__$, $__KC__$Find the maximum-margin hyperplane: maximize 2/‖w‖ s.t. y_i(w^T x_i + b) ≥ 1$__KC__$, $__KC__$Support vectors: training points on the margin. Dual is often easier to solve.
Soft margin: allow violations with slack ξ_i, penalty C. C controls bias-variance.
Kernel trick: replace x^T x → K(x,x') for non-linear boundaries (RBF, polynomial).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Support_Vector_Machine$__KC__$, 'ml', 'connect'),
  ('graph_knn', $__KC__$k-Nearest Neighbors$__KC__$, $__KC__$Classify by majority vote of k nearest neighbors; no training phase (lazy learner)$__KC__$, $__KC__$Distance metric: Euclidean, Manhattan, cosine. k controls bias-variance:
Small k → low bias, high variance. Large k → high bias, low variance.
Curse of dimensionality: distances become indistinguishable in high-D.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/k-Nearest_Neighbors$__KC__$, 'ml', 'understand'),
  ('graph_decision_tree', $__KC__$Decision Tree$__KC__$, $__KC__$Recursively split feature space to minimize impurity (Gini or information gain)$__KC__$, $__KC__$Gini(S) = 1 − Σ p_i². Entropy H(S) = −Σ p_i log p_i.
IG = H(parent) − Σ (|child|/|parent|) H(child).
Depth controls complexity. Prone to overfitting; prune or use ensemble.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Decision_Tree$__KC__$, 'ml', 'understand'),
  ('graph_random_forest', $__KC__$Random Forest$__KC__$, $__KC__$Ensemble of decision trees, each on a bootstrap sample with random feature subsets; average predictions$__KC__$, $__KC__$Reduces variance via bagging (bootstrap aggregating), not bias.
Feature subsampling: typically √n_features per split (classification).
Out-of-bag (OOB) error: free validation estimate. Feature importance via impurity decrease.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Random_Forest$__KC__$, 'ml', 'connect'),
  ('graph_gradient_boosting', $__KC__$Gradient Boosting$__KC__$, $__KC__$Sequentially fit shallow trees to negative gradients (residuals) of the current ensemble$__KC__$, $__KC__$F_t(x) = F_{t-1}(x) + α h_t(x) where h_t fits −∂L/∂F_{t-1}.
Learning rate α shrinks each tree's contribution (regularization).
XGBoost: 2nd-order Taylor + L1/L2 on tree weights. LightGBM: leaf-wise growth.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Gradient_Boosting$__KC__$, 'ml', 'connect'),
  ('graph_naive_bayes', $__KC__$Naive Bayes$__KC__$, $__KC__$Classify using Bayes' theorem + conditional independence assumption: P(y|x) ∝ P(y)·∏ P(x_i|y)$__KC__$, $__KC__$Naive = features are independent given y (strong, often violated assumption).
Gaussian NB for continuous; Bernoulli/Multinomial for text.
Fast training, good for high-dimensional sparse data (spam detection, NLP).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Naive_Bayes$__KC__$, 'ml', 'understand'),
  ('graph_overfitting', $__KC__$Overfitting$__KC__$, $__KC__$Model memorizes training noise: low training error but high test error$__KC__$, $__KC__$Detected by training–validation accuracy gap.
Fix: more data, regularization (L1/L2), dropout, early stopping, simpler model, cross-validation.
Underfitting: high bias, model too simple. Regularization trades bias↑ for variance↓.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Overfitting$__KC__$, 'ml', 'understand'),
  ('graph_cross_validation', $__KC__$Cross Validation$__KC__$, $__KC__$Estimate generalization by training/evaluating on multiple train/validation splits$__KC__$, $__KC__$K-fold: split into K folds; train on K−1, validate on 1; average K scores.
Stratified K-fold preserves class ratios. LOOCV: K=n, unbiased but expensive.
Always use for hyperparameter selection; never use test set for this.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Cross_Validation$__KC__$, 'ml', 'understand'),
  ('graph_feature_engineering', $__KC__$Feature Engineering$__KC__$, $__KC__$Transform raw inputs into informative features to improve model performance$__KC__$, $__KC__$Normalization: z-score (μ=0,σ=1) or min-max ([0,1]).
Encoding: one-hot for nominal, ordinal for ordered categoricals.
Transformations: log for skewed data, polynomial features for interactions. PCA for compression.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Feature_Engineering$__KC__$, 'ml', 'connect'),
  ('graph_ensemble_methods', $__KC__$Ensemble Methods$__KC__$, $__KC__$Combine multiple models to reduce error: bagging (variance↓), boosting (bias↓), stacking$__KC__$, $__KC__$Bagging: train independently on bootstrap samples, average (Random Forest).
Boosting: sequential, each model focuses on previous errors (Gradient Boosting, AdaBoost).
Stacking: use model predictions as features for a meta-learner. Diversity among models is key.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Ensemble_Methods$__KC__$, 'ml', 'connect'),
  ('graph_unsupervised_learning', $__KC__$Unsupervised Learning$__KC__$, $__KC__$Discover hidden structure in unlabeled data: clusters, latent factors, density, manifolds$__KC__$, $__KC__$Goal: find compact representations or natural groupings without supervision.
Algorithms: k-means, PCA, GMM, autoencoders, t-SNE, UMAP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Unsupervised_Learning$__KC__$, 'ml', 'connect'),
  ('graph_k_means', $__KC__$k-Means$__KC__$, $__KC__$Partition n points into k clusters by iterating: assign to nearest centroid → update centroids$__KC__$, $__KC__$Objective: minimize within-cluster sum of squares (WCSS = Σ_i Σ_{x∈C_i} ‖x − μ_i‖²).
Converges to local minimum. k-means++ initialization for better results.
Elbow method for k selection. Assumes spherical clusters; sensitive to outliers.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/k-Means$__KC__$, 'ml', 'understand'),
  ('graph_pca', $__KC__$Principal Component Analysis$__KC__$, $__KC__$Project data to directions of maximum variance; top eigenvectors of the covariance matrix$__KC__$, $__KC__$Cov = X^T X / n. Top-k eigenvectors = principal components.
Equivalent via SVD: X = UΣV^T — top-k columns of V.
Variance retained by PC_i = σ_i² / Σσ_j². Whitening: divide scores by σ_i.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Principal_Component_Analysis$__KC__$, 'ml', 'connect'),
  ('graph_gaussian_mixture_models', $__KC__$Gaussian Mixture Models$__KC__$, $__KC__$Model data as a mixture of K Gaussians: P(x) = Σ_k π_k N(x; μ_k, Σ_k)$__KC__$, $__KC__$Soft clustering: each point has responsibility r_{ik} = P(z=k|x_i).
Train via EM: E-step computes r_{ik}, M-step updates π_k, μ_k, Σ_k.
More flexible than k-means (arbitrary covariance). AIC/BIC for selecting K.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Gaussian_Mixture_Models$__KC__$, 'ml', 'apply'),
  ('graph_dbscan', $__KC__$DBSCAN$__KC__$, $__KC__$Density-based clustering: expand clusters from core points (≥ MinPts within ε-neighborhood)$__KC__$, $__KC__$Core point: ≥ MinPts within ε. Border: reachable from core. Noise: isolated.
Finds arbitrarily shaped clusters. Does not require K.
Sensitive to ε and MinPts. Fails with varying density.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/DBSCAN$__KC__$, 'ml', 'connect'),
  ('graph_hierarchical_clustering', $__KC__$Hierarchical Clustering$__KC__$, $__KC__$Build a dendrogram by iteratively merging (agglomerative) or splitting (divisive) clusters$__KC__$, $__KC__$Agglomerative: start with n singleton clusters; merge closest at each step.
Linkage criteria: single (min dist), complete (max dist), average, Ward (min variance increase).
Cut dendrogram at chosen height to get flat clustering.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Hierarchical_Clustering$__KC__$, 'ml', 'connect'),
  ('graph_em_algorithm', $__KC__$Expectation-Maximization$__KC__$, $__KC__$Expectation-Maximization: iteratively compute expected log-likelihood (E), then maximize (M)$__KC__$, $__KC__$E-step: compute Q(θ|θ_old) = E_Z[log P(X,Z|θ) | X, θ_old].
M-step: θ_new = argmax_θ Q.
Guaranteed to (weakly) increase log-likelihood each iteration. Converges to local max.
Applications: GMM, HMM, missing data imputation.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Expectation-Maximization$__KC__$, 'ml', 'apply'),
  ('graph_dimensionality_reduction', $__KC__$Dimensionality Reduction$__KC__$, $__KC__$Reduce feature count while preserving important structure (variance, distances, topology)$__KC__$, $__KC__$Linear: PCA (variance), LDA (class separation), ICA (independence).
Non-linear: t-SNE, UMAP (local structure), autoencoders (reconstruction).
Curse of dimensionality: in high-D, distances concentrate → nearest neighbor fails.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Dimensionality_Reduction$__KC__$, 'ml', 'connect'),
  ('graph_autoencoder', $__KC__$Autoencoder$__KC__$, $__KC__$Neural network trained to reconstruct input through a low-dimensional bottleneck$__KC__$, $__KC__$Encoder f: R^d → R^k (k < d) → bottleneck (latent code z) → Decoder g: R^k → R^d.
Loss: ‖x − g(f(x))‖². Learns compressed representation end-to-end.
Denoising AE: reconstruct clean x from corrupted x̃. VAE: adds distributional constraint on z.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Autoencoder$__KC__$, 'ml', 'connect'),
  ('graph_t_sne', $__KC__$t-SNE$__KC__$, $__KC__$Non-linear dimensionality reduction preserving local neighborhoods; used to visualize high-D data in 2D/3D$__KC__$, $__KC__$High-D similarities: Gaussian kernel. Low-D similarities: Student-t (heavy tails to prevent crowding).
Minimize KL(P_high || Q_low) via gradient descent.
Hyperparameters: perplexity (5–50), learning rate. Non-deterministic; distances between clusters not meaningful.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/t-SNE$__KC__$, 'ml', 'connect'),
  ('graph_reinforcement_learning', $__KC__$Reinforcement Learning$__KC__$, $__KC__$Learn to act by maximizing cumulative reward through trial-and-error interaction with an environment$__KC__$, $__KC__$Agent observes state s, takes action a, receives reward r, transitions to s'.
Goal: find policy π*(a|s) maximizing E[Σ γ^t r_t].
Methods: DP (model-based), TD learning, policy gradients, Q-learning.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Reinforcement_Learning$__KC__$, 'ml', 'apply'),
  ('graph_mdp', $__KC__$Markov Decision Process$__KC__$, $__KC__$Markov Decision Process (S, A, P, R, γ): the formal framework for sequential decision making$__KC__$, $__KC__$S: state space. A: actions. P(s'|s,a): transition. R(s,a): reward. γ: discount.
Policy π(a|s): action distribution. Value V^π(s) = E[Σ γ^t r_t | s_0=s, π].
Goal: find π* maximizing V^π*(s) for all s.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Markov_Decision_Process$__KC__$, 'ml', 'apply'),
  ('graph_bellman_equation', $__KC__$Bellman Equation$__KC__$, $__KC__$V*(s) = max_a [R(s,a) + γ Σ P(s'|s,a) V*(s')]: the recursive optimality condition$__KC__$, $__KC__$Decomposes value into immediate reward + discounted future value.
Q*(s,a) = R(s,a) + γ Σ P(s'|s,a) max_{a'} Q*(s',a').
Value Iteration: repeatedly apply Bellman operator until convergence. Foundation of all RL.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bellman_Equation$__KC__$, 'ml', 'apply'),
  ('graph_q_learning', $__KC__$Q-Learning$__KC__$, $__KC__$Off-policy TD: Q(s,a) ← Q(s,a) + α[r + γ max_{a'} Q(s',a') − Q(s,a)]$__KC__$, $__KC__$Target = r + γ max Q(s',·). Off-policy: learns Q* regardless of behavior policy.
TD error δ_t = r + γQ(s') − Q(s) is the learning signal.
DQN: approximate Q with a neural network + experience replay + target network.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Q-Learning$__KC__$, 'ml', 'connect'),
  ('graph_policy_gradient', $__KC__$Policy Gradient$__KC__$, $__KC__$Directly optimize policy π_θ by ascending the gradient of expected return J(θ)$__KC__$, $__KC__$REINFORCE: ∇J(θ) = E[∇log π_θ(a|s)·G_t]. High variance.
Baseline b(s): subtract to reduce variance (advantage = G_t − b(s)).
Actor-critic: b(s) = V(s). PPO clips importance ratio for stable training.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Policy_Gradient$__KC__$, 'ml', 'apply'),
  ('graph_value_function', $__KC__$Value Function$__KC__$, $__KC__$V^π(s) = E[Σ γ^t r_t | s_0=s, π] — expected cumulative discounted return from state s$__KC__$, $__KC__$Action-value Q(s,a) = R(s,a) + γ E[V(s')].
Advantage A(s,a) = Q(s,a) − V(s): quality of action relative to average.
Learned via TD methods (bootstrapped) or Monte Carlo (full episodes).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Value_Function$__KC__$, 'ml', 'connect'),
  ('graph_exploration_exploitation', $__KC__$Exploration vs Exploitation$__KC__$, $__KC__$Exploit known high-reward actions vs. explore unknowns to potentially find better ones$__KC__$, $__KC__$ε-greedy: random action with probability ε. Decay ε over training.
UCB: add bonus √(log t / N(a)) — "optimism in face of uncertainty".
Thompson Sampling: sample from posterior. Multi-armed bandit: simplest RL setting.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Exploration_vs_Exploitation$__KC__$, 'ml', 'connect'),
  ('graph_temporal_difference', $__KC__$Temporal Difference Learning$__KC__$, $__KC__$Update value estimates using bootstrapped targets without waiting for episode end$__KC__$, $__KC__$TD(0): V(s) ← V(s) + α[r + γV(s') − V(s)]. δ = r + γV(s') − V(s) is the TD error.
Advantage: online learning, works for continuing tasks, lower variance than MC.
TD(λ): eligibility traces blend TD(0) and Monte Carlo via parameter λ ∈ [0,1].$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Temporal_Difference_Learning$__KC__$, 'ml', 'apply'),
  ('graph_actor_critic', $__KC__$Actor-Critic$__KC__$, $__KC__$Actor π_θ selects actions; Critic V_φ estimates values to provide advantage baseline$__KC__$, $__KC__$Actor gradient: ∇_θ J ≈ ∇_θ log π_θ(a|s)·(r + γV_φ(s') − V_φ(s)).
Critic: update V_φ via TD error. More stable than pure policy gradient.
Modern variants: A3C (asynchronous), PPO (clipped ratio), SAC (entropy regularization).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Actor-Critic$__KC__$, 'ml', 'apply'),
  ('graph_reward_shaping', $__KC__$Reward Shaping$__KC__$, $__KC__$Add auxiliary rewards F(s,a,s') to the original reward to speed up learning without changing optimal policy$__KC__$, $__KC__$Potential-based shaping: F(s,a,s') = γΦ(s') − Φ(s). Preserves optimal policy (policy invariance theorem).
Wrong shaping can cause reward hacking (agent optimizes shaped reward instead of true reward).
Used in sparse-reward envs: dense signal guides early exploration.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Reward_Shaping$__KC__$, 'ml', 'connect'),
  ('graph_deep_learning', $__KC__$Deep Learning$__KC__$, $__KC__$Multi-layer neural networks that learn hierarchical representations from raw data$__KC__$, $__KC__$Depth enables compositionality: early layers = edges, mid = shapes, late = objects.
Trained end-to-end via backpropagation + gradient descent.
Key innovations: ReLU, dropout, batch norm, residual connections, attention.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Deep_Learning$__KC__$, 'ml', 'connect'),
  ('graph_neural_networks', $__KC__$Neural Networks$__KC__$, $__KC__$Compositions of linear layers + nonlinear activations: output = σ(W_L σ(…σ(W_1 x + b_1)…) + b_L)$__KC__$, $__KC__$Universal approximation: single hidden layer with enough neurons approximates any continuous function.
Depth provides hierarchical feature learning efficiently.
Trained via backpropagation; requires differentiable activations.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Neural_Networks$__KC__$, 'ml', 'connect'),
  ('graph_backpropagation', $__KC__$Backpropagation$__KC__$, $__KC__$Efficient computation of all gradients ∂L/∂w via the chain rule on the computational graph$__KC__$, $__KC__$Forward pass: compute activations, cache intermediates.
Backward pass: δ_l = (W_{l+1}^T δ_{l+1}) ⊙ σ'(z_l); ∂L/∂W_l = δ_l · a_{l-1}^T.
Same computational cost as one forward pass (O(parameters)).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Backpropagation$__KC__$, 'ml', 'connect'),
  ('graph_cnn', $__KC__$Convolutional Neural Network$__KC__$, $__KC__$Shared convolutional filters learn spatially local patterns; efficient for images via weight sharing$__KC__$, $__KC__$(I * K)[i,j] = Σ_{p,q} K[p,q]·I[i+p, j+q]. Output size: (W−F+2P)/S+1.
Inductive biases: translation invariance (pooling) and local connectivity.
Architecture: Conv → ReLU → Pool → … → FC. Basis of ResNet, VGG, EfficientNet.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Convolutional_Neural_Network$__KC__$, 'ml', 'connect'),
  ('graph_rnn', $__KC__$Recurrent Neural Network$__KC__$, $__KC__$h_t = σ(W_h h_{t-1} + W_x x_t + b): recurrent cell processes sequences step by step$__KC__$, $__KC__$Hidden state h_t carries sequential memory. Trained via BPTT (backprop through time).
Vanishing gradient: gradients shrink as ∂h_t/∂h_{t-k} → 0 over long sequences.
Gating (LSTM, GRU) solves this. RNN replaced by Transformers for most NLP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Recurrent_Neural_Network$__KC__$, 'ml', 'connect'),
  ('graph_lstm', $__KC__$Long Short-Term Memory$__KC__$, $__KC__$LSTM gating (forget f, input i, output o) allows cell state c_t to carry long-term memory$__KC__$, $__KC__$f_t = σ(W_f [h_{t-1}, x_t] + b_f)   (what to forget)
i_t = σ(W_i [h_{t-1}, x_t] + b_i)   (what to write)
c_t = f_t * c_{t-1} + i_t * tanh(W_c [h_{t-1}, x_t] + b_c)
h_t = o_t * tanh(c_t)
GRU: simplified 2-gate variant, fewer parameters.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Long_Short-Term_Memory$__KC__$, 'ml', 'apply'),
  ('graph_transformer', $__KC__$Transformer$__KC__$, $__KC__$Self-attention + feed-forward layers; fully parallelizable, captures long-range dependencies$__KC__$, $__KC__$Attention(Q,K,V) = softmax(QK^T/√d_k)V. Multi-head runs h parallel heads.
Positional encoding adds order information (sinusoidal or learned).
Encoder-decoder for seq2seq; decoder-only (GPT) for generation. O(n²) in sequence length.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Transformer$__KC__$, 'ml', 'apply'),
  ('graph_attention_mechanism', $__KC__$Attention Mechanism$__KC__$, $__KC__$Compute a weighted combination of values V based on query-key similarity scores$__KC__$, $__KC__$score(Q,K) = QK^T/√d_k. Attention weights α = softmax(scores).
Output = αV. Self-attention: Q=K=V from same sequence.
Cross-attention: Q from decoder, K,V from encoder. Foundation of Transformer.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Attention_Mechanism$__KC__$, 'ml', 'apply'),
  ('graph_regularization', $__KC__$Regularization$__KC__$, $__KC__$Techniques to prevent overfitting by constraining model capacity or adding noise$__KC__$, $__KC__$L2 (weight decay): λ‖w‖² → smooth, non-sparse. L1: λ‖w‖₁ → sparse.
Dropout: random zeroing. Data augmentation. Early stopping. Label smoothing.
All reduce variance at the cost of slight bias increase.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Regularization$__KC__$, 'ml', 'understand'),
  ('graph_batch_normalization', $__KC__$Batch Normalization$__KC__$, $__KC__$Normalize layer activations to zero mean/unit variance then rescale: BN(x) = γ·(x−μ)/σ + β$__KC__$, $__KC__$Statistics μ, σ computed over mini-batch during training; running stats at inference.
Enables higher learning rates, reduces sensitivity to initialization.
LayerNorm: normalize over features per-sample (preferred in Transformers).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Batch_Normalization$__KC__$, 'ml', 'connect'),
  ('graph_dropout', $__KC__$Dropout$__KC__$, $__KC__$Randomly zero each neuron with probability p during training; scale by 1/(1−p) at test time$__KC__$, $__KC__$Prevents co-adaptation: neurons cannot rely on specific other neurons.
Equivalent to training an ensemble of 2^n sub-networks (exponential in # neurons).
Inverted dropout: scale at train time → no modification at test time. p=0.5 hidden, 0.1 input.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Dropout$__KC__$, 'ml', 'understand'),
  ('graph_activation_functions', $__KC__$Activation Functions$__KC__$, $__KC__$Non-linear function applied after linear layer; essential for learning non-linear mappings$__KC__$, $__KC__$Without non-linearity: deep network ≡ single linear layer (no expressive power gain).
Key functions: ReLU (most common), sigmoid (output binary), tanh (centered), GELU (Transformers).
Must be differentiable (almost everywhere) for gradient-based training.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Activation_Functions$__KC__$, 'ml', 'understand'),
  ('graph_relu', $__KC__$ReLU$__KC__$, $__KC__$f(x) = max(0, x): zero for negative inputs, identity for positive — simple and widely used$__KC__$, $__KC__$Gradient: 1 if x>0, 0 if x≤0. No saturation for positive values → no vanishing gradient.
Dead ReLU: if pre-activation always ≤ 0, neuron never updates.
Fix: Leaky ReLU (0.01x for x<0), ELU, PReLU (learned slope).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/ReLU$__KC__$, 'ml', 'memorize'),
  ('graph_sigmoid', $__KC__$Sigmoid$__KC__$, $__KC__$σ(x) = 1/(1+e^{-x}) ∈ (0,1): maps any real number to a probability$__KC__$, $__KC__$Derivative: σ(x)(1−σ(x)) ≤ 0.25 — saturates at extremes → vanishing gradients.
Use in output layer for binary classification (paired with BCE loss).
Avoid in hidden layers (use ReLU). σ(−x) = 1 − σ(x).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sigmoid$__KC__$, 'ml', 'understand'),
  ('graph_softmax', $__KC__$Softmax$__KC__$, $__KC__$softmax(z)_i = e^{z_i} / Σ_j e^{z_j}: normalizes logits to a probability distribution$__KC__$, $__KC__$Output of multi-class classifier. Temperature T: softmax(z/T) — T→0: argmax, T→∞: uniform.
Numerically stable: subtract max(z) first (log-sum-exp trick).
log-softmax + NLLLoss = cross-entropy in PyTorch.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Softmax$__KC__$, 'ml', 'understand'),
  ('graph_weight_initialization', $__KC__$Weight Initialization$__KC__$, $__KC__$Initial weight values critically affect training dynamics; symmetry breaking is essential$__KC__$, $__KC__$Zero init: all neurons learn identical features (symmetry problem) → avoid.
Xavier/Glorot (tanh): Var(w) = 2/(n_in + n_out).
He/Kaiming (ReLU): Var(w) = 2/n_in.
Orthogonal initialization: good for RNNs.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Weight_Initialization$__KC__$, 'ml', 'connect'),
  ('graph_vanishing_gradient', $__KC__$Vanishing Gradient Problem$__KC__$, $__KC__$Gradients shrink exponentially through layers, making early layers learn extremely slowly$__KC__$, $__KC__$Cause: sigmoid derivative ≤ 0.25 — multiply L times → (0.25)^L ≈ 0.
Fix: ReLU activations, residual connections, LSTM gating, batch normalization.
Exploding gradients: clip gradient norm (‖g‖ > threshold → g = g·threshold/‖g‖).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Vanishing_Gradient_Problem$__KC__$, 'ml', 'connect'),
  ('graph_residual_connections', $__KC__$Residual Connections$__KC__$, $__KC__$Skip connections add input directly to output: y = F(x) + x (ResNet)$__KC__$, $__KC__$Gradient flows directly through identity shortcut: ∂L/∂x = ∂L/∂y·(1 + ∂F/∂x).
Key insight: learn residual F(x) = H(x)−x (easier to push F→0 than H→identity).
Enables training of 100+ layer networks. Used in ResNet, Transformer (pre/post-LN).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Residual_Connections$__KC__$, 'ml', 'connect'),
  ('graph_gan', $__KC__$Generative Adversarial Network$__KC__$, $__KC__$Generator G produces fakes; Discriminator D distinguishes real vs. fake — minimax game$__KC__$, $__KC__$min_G max_D E[log D(x)] + E[log(1−D(G(z)))].
Nash equilibrium: G(z) ~ P_data, D(x) = 0.5 everywhere.
Challenges: mode collapse, training instability. WGAN uses Wasserstein distance for stability.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Generative_Adversarial_Network$__KC__$, 'ml', 'apply'),
  ('graph_vae', $__KC__$Variational Autoencoder$__KC__$, $__KC__$Variational Autoencoder: encoder → (μ,σ) latent; decoder reconstructs; trained via ELBO$__KC__$, $__KC__$ELBO = E_{q_φ(z|x)}[log p_θ(x|z)] − KL(q_φ(z|x) ‖ p(z)).
Reparameterization: z = μ + σ·ε, ε~N(0,I) — enables backprop through sampling.
Smooth latent space → interpolation, generation. Lower quality than GAN, but stable training.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Variational_Autoencoder$__KC__$, 'ml', 'apply'),
  ('graph_transfer_learning', $__KC__$Transfer Learning$__KC__$, $__KC__$Reuse a model pre-trained on a large dataset for a different but related task$__KC__$, $__KC__$Feature extraction: freeze base, train only new head (fast, few data).
Fine-tuning: update all weights on new task with small lr.
ImageNet features transfer broadly to vision. BERT/GPT for NLP. Domain adaptation handles distribution shift.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Transfer_Learning$__KC__$, 'ml', 'connect'),
  ('graph_fine_tuning', $__KC__$Fine-Tuning$__KC__$, $__KC__$Adapt a pre-trained model by continuing training on task-specific data, typically with a small learning rate$__KC__$, $__KC__$Learning rate: 10–100× smaller than pre-training (avoid destroying learned features).
Strategies: freeze early layers (generic), unfreeze later (task-specific).
Catastrophic forgetting: model loses pre-training knowledge. LoRA: fine-tune low-rank matrix updates only.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Fine-Tuning$__KC__$, 'ml', 'connect'),
  ('graph_embeddings', $__KC__$Embeddings$__KC__$, $__KC__$Dense low-dimensional vector representations of discrete objects (words, items, categories)$__KC__$, $__KC__$Learned end-to-end or separately. Similar objects cluster in embedding space.
Word embeddings: distributional semantics — king − man + woman ≈ queen (Word2Vec, GloVe).
Item embeddings: collaborative filtering. Graph embeddings: Node2Vec. Typical dim: 64–1024.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Embeddings$__KC__$, 'ml', 'connect'),
  ('graph_word2vec', $__KC__$Word2Vec$__KC__$, $__KC__$Train a shallow neural net on word context prediction to produce dense word embeddings$__KC__$, $__KC__$CBOW: predict center word from context. Skip-gram: predict context from center.
Objective: maximize P(context | word) via softmax over vocabulary.
Key property: analogies via vector arithmetic. Basis for all modern NLP embeddings.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Word2Vec$__KC__$, 'ml', 'connect'),
  ('graph_positional_encoding', $__KC__$Positional Encoding$__KC__$, $__KC__$Add position-dependent vectors to embeddings; Transformers have no inherent sequence order$__KC__$, $__KC__$Sinusoidal: PE(pos, 2i) = sin(pos/10000^{2i/d}); PE(pos, 2i+1) = cos(…).
Unique per position; relative positions computable via dot product.
RoPE (Rotary): encodes relative positions in attention directly → better length generalization.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Positional_Encoding$__KC__$, 'ml', 'connect'),
  ('graph_multi_head_attention', $__KC__$Multi-Head Attention$__KC__$, $__KC__$Run h parallel attention heads on different linear projections; concatenate and project$__KC__$, $__KC__$Each head: Attention(QW_i^Q, KW_i^K, VW_i^V).
Concat all h heads → multiply by W^O.
Different heads capture different relationships (syntax, semantics, long-range). h typically 8–16; d_head = d_model/h.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Multi-Head_Attention$__KC__$, 'ml', 'apply'),
  ('graph_layer_normalization', $__KC__$Layer Normalization$__KC__$, $__KC__$Normalize activations across features per sample: LN(x) = γ(x−μ)/σ + β$__KC__$, $__KC__$Statistics computed over feature dimension (not batch dimension like BatchNorm).
No batch-size dependency; stable with small batches and RNNs.
Pre-LN (before attention/FFN) more stable than Post-LN for deep Transformers.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Layer_Normalization$__KC__$, 'ml', 'connect'),
  ('graph_bert', $__KC__$BERT$__KC__$, $__KC__$Bidirectional Encoder pre-trained on Masked LM + NSP; fine-tuned for downstream NLP tasks$__KC__$, $__KC__$MLM: predict 15% masked tokens (80% → [MASK], 10% → random, 10% → unchanged).
NSP: predict if sentence B follows sentence A (removed in RoBERTa).
[CLS] token for classification. Bidirectional context: better than GPT for understanding tasks.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/BERT$__KC__$, 'ml', 'apply'),
  ('graph_gpt', $__KC__$GPT$__KC__$, $__KC__$Autoregressive decoder pre-trained on next-token prediction; excels at generation and in-context learning$__KC__$, $__KC__$Causal (left-to-right) attention: each token attends only to previous tokens.
Pre-trained on next-token prediction (language modeling) at scale.
In-context learning: provide examples in prompt — no gradient update needed.
GPT-3: 175B parameters. GPT-4: multimodal.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/GPT$__KC__$, 'ml', 'apply'),
  ('graph_diffusion_models', $__KC__$Diffusion Models$__KC__$, $__KC__$Generate data by learning to reverse a gradual Gaussian noise process over T steps$__KC__$, $__KC__$Forward: q(x_t|x_0) = N(√ᾱ_t x_0, (1−ᾱ_t)I). Adds noise over T steps.
Reverse: learn ε_θ(x_t, t) to predict the noise added.
Loss: L = E[‖ε − ε_θ(x_t, t)‖²]. Stable training; slow sampling (DDIM speeds it up).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Diffusion_Models$__KC__$, 'ml', 'apply'),
  ('graph_theoretical_ml', $__KC__$Theoretical ML$__KC__$, $__KC__$Mathematical foundations of ML: generalization, complexity, information theory, learnability$__KC__$, $__KC__$Key questions: when can we learn? How much data is needed? What is the fundamental limit?
Tools: PAC learning, VC dimension, Rademacher complexity, information theory.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Theoretical_ML$__KC__$, 'other', 'apply'),
  ('graph_vc_dimension', $__KC__$VC Dimension$__KC__$, $__KC__$VC(H): max number of points that hypothesis class H can shatter (correctly classify all 2^n labelings)$__KC__$, $__KC__$Higher VC dim → more expressive, but needs more data to generalize.
Generalization bound: err ≤ train_err + O(√(d·log(n/d)/n)).
Linear classifiers in R^d: VC = d+1. Infinite VC → may not PAC-learn.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/VC_Dimension$__KC__$, 'other', 'apply'),
  ('graph_pac_learning', $__KC__$PAC Learning$__KC__$, $__KC__$PAC: Probably Approximately Correct — with probability ≥ 1−δ, learn hypothesis with error ≤ ε$__KC__$, $__KC__$Sample complexity: n ≥ (1/ε)(log|H| + log(1/δ)) for finite H.
Agnostic PAC: no realizable assumption; bound includes best-in-H error.
VC dimension generalizes PAC to infinite hypothesis classes.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/PAC_Learning$__KC__$, 'other', 'apply'),
  ('graph_bias_variance_tradeoff', $__KC__$Bias-Variance Tradeoff$__KC__$, $__KC__$MSE = Bias² + Variance + Noise; complex models lower bias but raise variance$__KC__$, $__KC__$Bias = E[f̂(x)] − f(x): systematic error from wrong model assumptions.
Variance = E[(f̂ − E[f̂])²]: sensitivity to training data fluctuations.
Regularization increases bias to reduce variance. Cross-validation selects the optimal tradeoff.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bias-Variance_Tradeoff$__KC__$, 'other', 'connect'),
  ('graph_information_theory', $__KC__$Information Theory$__KC__$, $__KC__$Quantifies information, uncertainty, and communication limits using entropy and divergence$__KC__$, $__KC__$Entropy H(X) = −Σ p log p. Mutual information I(X;Y) = H(X) − H(X|Y).
Channel capacity C = max_p I(X;Y) (Shannon, 1948).
KL divergence, cross-entropy, rate-distortion theory underpin all of ML theory.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Information_Theory$__KC__$, 'other', 'connect'),
  ('graph_kl_divergence', $__KC__$KL Divergence$__KC__$, $__KC__$KL(P‖Q) = Σ P(x) log[P(x)/Q(x)] ≥ 0: information lost when using Q to approximate P$__KC__$, $__KC__$Non-negative (Gibbs inequality); equals 0 iff P = Q. NOT symmetric.
Forward KL (P‖Q): zero-avoiding; Reverse KL (Q‖P): zero-forcing.
ELBO = E[log p(x|z)] − KL(q(z|x)‖p(z)). Fundamental in VAE, information geometry.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/KL_Divergence$__KC__$, 'other', 'connect'),
  ('graph_mutual_information', $__KC__$Mutual Information$__KC__$, $__KC__$I(X;Y) = H(X) − H(X|Y): reduction in uncertainty about X when Y is observed$__KC__$, $__KC__$Symmetric: I(X;Y) = I(Y;X). Zero iff X,Y independent.
I(X;Y) = KL(P_{XY} ‖ P_X P_Y) = Σ P(x,y) log[P(x,y)/(P(x)P(y))].
Feature selection: pick features maximizing I(X;label). Upper-bounded by channel capacity.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Mutual_Information$__KC__$, 'other', 'connect'),
  ('graph_entropy', $__KC__$Entropy$__KC__$, $__KC__$H(X) = −Σ p(x) log₂ p(x) bits: average surprise / uncertainty in a random variable$__KC__$, $__KC__$Max entropy: uniform distribution H = log₂|X|. Zero entropy: deterministic.
Binary entropy: H(p) = −p log p − (1−p) log(1−p), max at p = 0.5 (1 bit).
Cross-entropy H(p,q) = H(p) + KL(p‖q). Used directly as loss in classification.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Entropy$__KC__$, 'other', 'connect'),
  ('graph_no_free_lunch', $__KC__$No Free Lunch Theorem$__KC__$, $__KC__$No single algorithm outperforms all others when averaged over all possible problems$__KC__$, $__KC__$Formal: Σ_f L(a₁,f) = Σ_f L(a₂,f) for any two algorithms a₁, a₂.
Implication: performance depends on how well inductive bias matches the problem structure.
Justifies why domain knowledge, feature engineering, and model selection matter.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/No_Free_Lunch_Theorem$__KC__$, 'other', 'connect'),
  ('graph_rademacher_complexity', $__KC__$Rademacher Complexity$__KC__$, $__KC__$Measures the capacity of a hypothesis class by how well it fits random ±1 noise labels$__KC__$, $__KC__$R_n(H) = E_σ[sup_{h∈H} (1/n) Σ σ_i h(x_i)], σ_i ∈ {±1} i.i.d.
Generalization bound: err ≤ train_err + 2R_n(H) + O(√(log(1/δ)/n)).
Data-dependent; tighter than VC dim for structured problems.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Rademacher_Complexity$__KC__$, 'other', 'apply'),
  ('graph_generalization_bounds', $__KC__$Generalization Bounds$__KC__$, $__KC__$Upper bounds on the gap between training error and true (population) error$__KC__$, $__KC__$Uniform convergence: P(sup_{h∈H}|R(h)−R̂(h)| > ε) ≤ δ.
Tools: VC dim, Rademacher complexity, PAC-Bayes bounds.
Key insight: larger hypothesis class → looser bound; need data to "earn" complexity.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Generalization_Bounds$__KC__$, 'other', 'apply'),
  ('graph_statistical_learning_theory', $__KC__$Statistical Learning Theory$__KC__$, $__KC__$Mathematical framework analyzing when and how fast learning algorithms generalize$__KC__$, $__KC__$Core questions: (1) Is H learnable? (2) How many samples? (3) Which algorithm?
PAC framework, VC theory, Rademacher complexity are main tools.
Bridge between empirical ML practice and theoretical guarantees.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Statistical_Learning_Theory$__KC__$, 'other', 'apply'),
  ('graph_rank', $__KC__$Matrix Rank$__KC__$, $__KC__$Rank(A) = dimension of the column space = number of linearly independent columns$__KC__$, $__KC__$rank(A) + nullity(A) = n (Rank-Nullity theorem). rank(A) = rank(A^T).
Full rank: rank = min(m,n). Rank-deficient → non-invertible.
Determined via row reduction (# pivot positions) or # nonzero singular values.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Matrix_Rank$__KC__$, 'other', 'understand'),
  ('graph_null_space', $__KC__$Null Space$__KC__$, $__KC__$Null(A) = {x : Ax = 0}: the set of all vectors mapped to zero by A$__KC__$, $__KC__$dim(Null(A)) = nullity(A) = n − rank(A).
Ax = b has solution iff b ∈ col(A); general solution = particular + null space.
Null space ⊥ row space. Compute via row reduction of [A | 0].$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Null_Space$__KC__$, 'other', 'connect'),
  ('graph_column_space', $__KC__$Column Space$__KC__$, $__KC__$col(A): the set of all vectors Ax that A can produce — the image of the linear map$__KC__$, $__KC__$col(A) = span of columns of A. dim(col(A)) = rank(A).
Ax = b has a solution iff b ∈ col(A).
Projection onto col(A): P = A(A^T A)^{-1} A^T (used in least squares).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Column_Space$__KC__$, 'other', 'connect'),
  ('graph_change_of_basis', $__KC__$Change of Basis$__KC__$, $__KC__$Rewrite vectors / matrices in a different coordinate system via an invertible matrix P$__KC__$, $__KC__$If P = [b₁ | … | bₙ] (new basis as columns), then [v]_B = P^{-1} v.
Matrix in new basis: A_B = P^{-1} A P (similarity transform).
Choosing eigenvectors as basis diagonalizes A: P^{-1}AP = D.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Change_of_Basis$__KC__$, 'other', 'connect'),
  ('graph_projection_matrix', $__KC__$Projection Matrix$__KC__$, $__KC__$P² = P: idempotent matrix that projects any vector onto a fixed subspace$__KC__$, $__KC__$Orthogonal projection onto col(A): P = A(A^T A)^{-1} A^T, symmetric and idempotent.
I − P projects onto the orthogonal complement.
Used in least squares (project b onto col(A)), PCA, and Gram-Schmidt.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Projection_Matrix$__KC__$, 'other', 'connect'),
  ('graph_orthonormal_basis', $__KC__$Orthonormal Basis$__KC__$, $__KC__$Basis {q₁,…,qₙ} where qᵢ·qⱼ = δᵢⱼ (pairwise orthogonal and unit-length vectors)$__KC__$, $__KC__$If Q = [q₁|…|qₙ], then Q^T Q = I (orthogonal matrix: Q^T = Q^{-1}).
Coordinates easy: [v]_Q = Q^T v. Projection: Pv = QQ^T v.
Gram-Schmidt: build orthonormal basis from any linearly independent set.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Orthonormal_Basis$__KC__$, 'other', 'connect'),
  ('graph_spectral_theorem', $__KC__$Spectral Theorem$__KC__$, $__KC__$Every real symmetric matrix A = QΛQ^T has real eigenvalues and orthogonal eigenvectors$__KC__$, $__KC__$Q is orthogonal, Λ = diag(λ₁,…,λₙ). Decomposition is unique (up to sign/order).
Positive semidefinite ↔ all λᵢ ≥ 0. PD ↔ all λᵢ > 0.
Foundation for PCA (cov matrix is symmetric), kernel methods, quadratic forms.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Spectral_Theorem$__KC__$, 'other', 'apply'),
  ('graph_moore_penrose_pseudoinverse', $__KC__$Moore-Penrose Pseudoinverse$__KC__$, $__KC__$A† = V Σ† U^T: generalized inverse giving the least-norm minimum-residual solution$__KC__$, $__KC__$For Ax = b: x† = A†b is least-squares solution with minimum norm.
Full column rank: A† = (A^T A)^{-1}A^T. Full row rank: A† = A^T(AA^T)^{-1}.
Computed via SVD: Σ†_{ii} = 1/σ_i if σ_i > 0, else 0.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Moore-Penrose_Pseudoinverse$__KC__$, 'other', 'apply'),
  ('graph_bernoulli_distribution', $__KC__$Bernoulli Distribution$__KC__$, $__KC__$Models a single binary trial: P(X=1) = p, P(X=0) = 1−p$__KC__$, $__KC__$E[X] = p. Var(X) = p(1−p). Max variance at p = 0.5.
Building block for Binomial. Log-likelihood for logistic regression is Bernoulli log-likelihood.
Entropy: H = −p log p − (1−p) log(1−p).$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bernoulli_Distribution$__KC__$, 'other', 'understand'),
  ('graph_binomial_distribution', $__KC__$Binomial Distribution$__KC__$, $__KC__$X ~ Bin(n,p): number of successes in n independent Bernoulli(p) trials$__KC__$, $__KC__$P(X=k) = C(n,k) pᵏ (1−p)^{n−k}. E[X] = np. Var(X) = np(1−p).
Approximations: Normal N(np, np(1−p)) for large n; Poisson(np) when n large, p small.
Used in A/B testing, quality control, click-through models.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Binomial_Distribution$__KC__$, 'other', 'understand'),
  ('graph_poisson_distribution', $__KC__$Poisson Distribution$__KC__$, $__KC__$X ~ Poisson(λ): models rare event counts in a fixed interval when rate = λ$__KC__$, $__KC__$P(X=k) = e^{-λ} λᵏ / k!. E[X] = Var(X) = λ (mean = variance — key identifier).
Limit of Bin(n,p) as n→∞, p→0, np→λ.
Used for: server requests, typos per page, radioactive decay counts.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Poisson_Distribution$__KC__$, 'other', 'understand'),
  ('graph_exponential_distribution', $__KC__$Exponential Distribution$__KC__$, $__KC__$X ~ Exp(λ): models waiting time between Poisson events; P(X>t) = e^{-λt}$__KC__$, $__KC__$PDF: f(x) = λe^{-λx}. E[X] = 1/λ. Var(X) = 1/λ².
Memoryless property: P(X > s+t | X > s) = P(X > t). Unique continuous memoryless distribution.
Used in reliability, queuing theory, survival analysis.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Exponential_Distribution$__KC__$, 'other', 'understand'),
  ('graph_sampling_methods', $__KC__$Sampling Methods$__KC__$, $__KC__$Techniques to draw samples from distributions: inverse CDF, rejection, MCMC, importance sampling$__KC__$, $__KC__$Inverse CDF: if F is the CDF, then F^{-1}(U) ~ target for U ~ Uniform.
Rejection sampling: sample from proposal, accept with prob f(x)/(M·g(x)).
MCMC (Metropolis-Hastings, Gibbs): build Markov chain with target as stationary distribution.
Importance sampling: estimate E_p[f] = E_q[f(x)p(x)/q(x)] — vital in RL and Bayesian inference.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sampling_Methods$__KC__$, 'other', 'understand'),
  ('graph_monte_carlo_methods', $__KC__$Monte Carlo Methods$__KC__$, $__KC__$Estimate expectations using random samples: E[f(X)] ≈ (1/N) Σ f(xᵢ), xᵢ ~ p$__KC__$, $__KC__$Error ∝ 1/√N (CLT) regardless of dimension — beats numerical quadrature in high-D.
Variance reduction: importance sampling, control variates, antithetic variables.
Monte Carlo integration, MCMC, policy gradient estimation, stochastic simulation all rely on this.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Monte_Carlo_Methods$__KC__$, 'other', 'connect'),
  ('graph_confidence_interval', $__KC__$Confidence Interval$__KC__$, $__KC__$A range [L, U] such that P(θ ∈ [L,U]) ≥ 1−α over repeated sampling (frequentist)$__KC__$, $__KC__$95% CI for mean: x̄ ± 1.96 σ/√n (large n, CLT).
Misinterpretation: NOT "95% chance θ is in this interval" — θ is fixed, interval is random.
Wider CI → less data or more variance. Used in A/B testing, polling, clinical trials.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Confidence_Interval$__KC__$, 'other', 'understand'),
  ('graph_a_b_testing', $__KC__$A/B Testing$__KC__$, $__KC__$Randomized controlled experiment comparing metric of two variants (A = control, B = treatment)$__KC__$, $__KC__$Null H₀: μ_A = μ_B. Reject if p-value < α (typically 0.05).
Two-sample t-test or z-test; minimum sample size: n ≈ (z_α + z_β)² · 2σ² / δ².
Pitfalls: peeking (inflates false positive rate), novelty effect, network effects.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/A%2FB_Testing$__KC__$, 'other', 'understand'),
  ('graph_constrained_optimization', $__KC__$Constrained Optimization$__KC__$, $__KC__$min f(x) subject to g(x) ≤ 0, h(x) = 0: optimize with equality and inequality constraints$__KC__$, $__KC__$KKT conditions (necessary): ∇f + Σλᵢ∇gᵢ + Σμⱼ∇hⱼ = 0, λᵢ ≥ 0, λᵢgᵢ = 0.
Lagrangian: L(x,λ,μ) = f(x) + λᵀg(x) + μᵀh(x).
Convex problems: KKT sufficient; strong duality (Slater). Underlies SVMs, LP, QP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Constrained_Optimization$__KC__$, 'other', 'apply'),
  ('graph_projected_gradient_descent', $__KC__$Projected Gradient Descent$__KC__$, $__KC__$Gradient descent step followed by projection back onto the feasible set C$__KC__$, $__KC__$Update: x_{t+1} = Π_C(x_t − α∇f(x_t)).
Π_C(y) = argmin_{x∈C} ‖x − y‖ (closest point in C).
For L-smooth f, converges at O(1/t). Used in SVMs, non-negative matrix factorization, lasso.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Projected_Gradient_Descent$__KC__$, 'other', 'apply'),
  ('graph_newton_method', $__KC__$Newton's Method$__KC__$, $__KC__$Second-order optimization: x_{k+1} = x_k − H^{-1}∇f — uses curvature for faster convergence$__KC__$, $__KC__$Quadratic convergence near optimum (vs. linear for GD).
Cost: O(n²) store H, O(n³) invert per step — prohibitive for large n.
Quasi-Newton (L-BFGS): approximate H^{-1} using gradient history. Used in logistic regression.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Newton's_Method$__KC__$, 'other', 'apply'),
  ('graph_line_search', $__KC__$Line Search$__KC__$, $__KC__$Procedure to choose step size α in gradient descent: find α that sufficiently decreases f$__KC__$, $__KC__$Exact: α* = argmin_α f(x − α∇f(x)). Expensive; used in quasi-Newton.
Armijo (sufficient decrease): f(x − αg) ≤ f(x) − c₁α‖g‖².
Wolfe conditions add curvature condition. Backtracking: start large, halve until Armijo holds.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Line_Search$__KC__$, 'other', 'connect'),
  ('graph_l1_regularization', $__KC__$L1 Regularization$__KC__$, $__KC__$Add λ‖w‖₁ = λΣ|w_i| to loss — promotes sparsity by driving small weights to exactly zero$__KC__$, $__KC__$Non-smooth at 0; sub-gradient or proximal operator needed.
Proximal (soft-threshold): S_λ(w_i) = sign(w_i)·max(|w_i|−λ, 0).
Lasso regression uses L1. MAP equivalent: Laplace prior. Good for feature selection.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/L1_Regularization$__KC__$, 'other', 'connect'),
  ('graph_l2_regularization', $__KC__$L2 Regularization$__KC__$, $__KC__$Add λ‖w‖₂² = λΣw_i² to loss (weight decay) — shrinks weights toward zero smoothly$__KC__$, $__KC__$Gradient of penalty: 2λw → update: w ← (1−2αλ)w − α∇L (weight decay).
MAP with Gaussian prior N(0, 1/2λ). Closed-form Ridge: β̂ = (X^T X + λI)^{-1}X^T y.
Weights never exactly zero (unlike L1); prefers small but non-sparse solutions.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/L2_Regularization$__KC__$, 'other', 'connect'),
  ('graph_proximal_gradient', $__KC__$Proximal Gradient$__KC__$, $__KC__$Splits objective into smooth f + non-smooth g: prox step handles g exactly$__KC__$, $__KC__$Update: x_{t+1} = prox_{αg}(x_t − α∇f(x_t)).
prox_g(v) = argmin_x [g(x) + (1/2α)‖x − v‖²].
Lasso: prox of λ‖·‖₁ is soft-thresholding. Enables sparse/non-smooth optimization at gradient cost.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Proximal_Gradient$__KC__$, 'other', 'apply'),
  ('graph_kkt_conditions', $__KC__$KKT Conditions$__KC__$, $__KC__$Necessary optimality conditions for constrained optimization: stationarity, feasibility, complementary slackness$__KC__$, $__KC__$∇f(x*) + Σλ_i∇g_i + Σν_j∇h_j = 0  (stationarity)
λ_i ≥ 0  (dual feasibility)
g_i(x*) ≤ 0  (primal feasibility)
λ_i g_i(x*) = 0  (complementary slackness)
Sufficient for convex problems.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/KKT_Conditions$__KC__$, 'other', 'apply'),
  ('graph_limits', $__KC__$Limits$__KC__$, $__KC__$lim_{x→a} f(x) = L: f(x) approaches L as x approaches a, regardless of f(a)$__KC__$, $__KC__$ε-δ definition: ∀ε>0 ∃δ>0: 0<|x−a|<δ ⟹ |f(x)−L|<ε.
L'Hôpital: if 0/0 or ∞/∞, lim f/g = lim f'/g'.
Limits underpin derivatives, integrals, and continuity — the foundation of all analysis.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Limits$__KC__$, 'other', 'memorize'),
  ('graph_continuity', $__KC__$Continuity$__KC__$, $__KC__$f continuous at a iff lim_{x→a} f(x) = f(a): no jumps, holes, or asymptotes$__KC__$, $__KC__$Types: removable discontinuity (hole), jump discontinuity, infinite discontinuity.
Extreme Value Theorem: f continuous on [a,b] → attains max and min.
Lipschitz continuity |f(x)−f(y)| ≤ L|x−y| guarantees convergence of gradient descent.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Continuity$__KC__$, 'other', 'memorize'),
  ('graph_multivariate_chain_rule', $__KC__$Multivariate Chain Rule$__KC__$, $__KC__$∂f/∂t = Σᵢ (∂f/∂xᵢ)(∂xᵢ/∂t): chain rule generalized to functions of multiple variables$__KC__$, $__KC__$Matrix form: df/dt = (∇_x f)^T · (dx/dt) = Jacobian × velocity.
For neural nets: backpropagation IS the multivariate chain rule applied recursively.
Key: partial derivatives compose along every path in the computation graph.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Multivariate_Chain_Rule$__KC__$, 'other', 'connect'),
  ('graph_directional_derivative', $__KC__$Directional Derivative$__KC__$, $__KC__$D_u f(x) = ∇f(x)·û: rate of change of f at x in direction unit vector û$__KC__$, $__KC__$Maximum directional derivative is |∇f| in direction ∇f/|∇f| (gradient direction).
Zero directional derivative → û perpendicular to ∇f (level set tangent).
Foundation: gradient descent moves in the direction of steepest decrease −∇f.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Directional_Derivative$__KC__$, 'other', 'connect'),
  ('graph_implicit_function_theorem', $__KC__$Implicit Function Theorem$__KC__$, $__KC__$If F(x,y)=0 and ∂F/∂y ≠ 0, then y is locally a function of x with dy/dx = −(∂F/∂x)/(∂F/∂y)$__KC__$, $__KC__$Generalizes to F: R^{n+m} → R^m; gives conditions for implicit definition of m variables.
Used to differentiate through constraints (Lagrange multipliers, implicit layers in DL).
Implicit differentiation in optimization: how optimal solution changes with parameters.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Implicit_Function_Theorem$__KC__$, 'other', 'apply'),
  ('graph_jacobian_determinant', $__KC__$Jacobian Determinant$__KC__$, $__KC__$det(J_F): scales volume under transformation F: R^n → R^n (change of variables in integrals)$__KC__$, $__KC__$Change of variables: ∫f(y)dy = ∫f(F(x))|det J_F(x)|dx.
For F linear: J_F = A, det J_F = det(A) (volume scaling factor).
Used in normalizing flows (bijective neural nets modeling densities), physics simulations.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Jacobian_Determinant$__KC__$, 'other', 'connect'),
  ('graph_shortest_path_algorithms', $__KC__$Shortest Path Algorithms$__KC__$, $__KC__$Find minimum-weight path between nodes: Dijkstra (non-neg weights), Bellman-Ford, A*$__KC__$, $__KC__$Dijkstra: O((V+E) log V) with min-heap; greedy, requires non-negative weights.
Bellman-Ford: O(VE), handles negative weights, detects negative cycles.
A*: Dijkstra + heuristic h(v) ≤ true cost; optimal if h is admissible (never overestimates).
Used in GPS routing, network flow, game AI pathfinding.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Shortest_Path_Algorithms$__KC__$, 'info', 'connect'),
  ('graph_minimum_spanning_tree', $__KC__$Minimum Spanning Tree$__KC__$, $__KC__$Minimum-weight connected subgraph spanning all V vertices: Kruskal's or Prim's algorithm$__KC__$, $__KC__$Kruskal: sort edges, add if no cycle (Union-Find) → O(E log E).
Prim: grow tree greedily from a vertex, pick min-weight crossing edge → O(E log V).
Cut property: lightest edge crossing any cut belongs to some MST.
Used in network design, clustering (single-linkage), approximate TSP.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Minimum_Spanning_Tree$__KC__$, 'info', 'connect'),
  ('graph_topological_sort', $__KC__$Topological Sort$__KC__$, $__KC__$algorithm in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 2/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Topological_Sort$__KC__$, 'info', 'understand'),
  ('graph_floyd_warshall', $__KC__$Floyd-Warshall$__KC__$, $__KC__$algorithm in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 4/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Floyd-Warshall$__KC__$, 'info', 'apply'),
  ('graph_bellman_ford', $__KC__$Bellman-Ford$__KC__$, $__KC__$algorithm in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bellman-Ford$__KC__$, 'info', 'connect'),
  ('graph_union_find', $__KC__$Union-Find$__KC__$, $__KC__$concept in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Union-Find$__KC__$, 'info', 'understand'),
  ('graph_amortized_analysis', $__KC__$Amortized Analysis$__KC__$, $__KC__$concept in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Amortized_Analysis$__KC__$, 'info', 'connect'),
  ('graph_string_matching', $__KC__$String Matching$__KC__$, $__KC__$algorithm in Algorithms$__KC__$, $__KC__$Domain: Algorithms
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/String_Matching$__KC__$, 'info', 'connect'),
  ('graph_disjoint_set', $__KC__$Disjoint Set$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Disjoint_Set$__KC__$, 'info', 'understand'),
  ('graph_priority_queue', $__KC__$Priority Queue$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Priority_Queue$__KC__$, 'info', 'understand'),
  ('graph_segment_tree', $__KC__$Segment Tree$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Segment_Tree$__KC__$, 'info', 'connect'),
  ('graph_fenwick_tree', $__KC__$Fenwick Tree$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Fenwick_Tree$__KC__$, 'info', 'connect'),
  ('graph_b_tree', $__KC__$B-Tree$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/B-Tree$__KC__$, 'info', 'connect'),
  ('graph_bloom_filter', $__KC__$Bloom Filter$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Bloom_Filter$__KC__$, 'info', 'connect'),
  ('graph_adjacency_list', $__KC__$Adjacency List$__KC__$, $__KC__$concept in Data Structures$__KC__$, $__KC__$Domain: Data Structures
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Adjacency_List$__KC__$, 'info', 'understand'),
  ('graph_reduction', $__KC__$Reduction$__KC__$, $__KC__$concept in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Reduction$__KC__$, 'other', 'connect')
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
  ('graph_polynomial_time', $__KC__$Polynomial Time$__KC__$, $__KC__$concept in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Polynomial_Time$__KC__$, 'other', 'understand'),
  ('graph_nondeterminism', $__KC__$Nondeterminism$__KC__$, $__KC__$concept in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Nondeterminism$__KC__$, 'other', 'connect'),
  ('graph_decision_problem', $__KC__$Decision Problem$__KC__$, $__KC__$concept in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Decision_Problem$__KC__$, 'other', 'understand'),
  ('graph_approximation_algorithms', $__KC__$Approximation Algorithms$__KC__$, $__KC__$algorithm in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 4/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Approximation_Algorithms$__KC__$, 'other', 'apply'),
  ('graph_randomized_algorithms', $__KC__$Randomized Algorithms$__KC__$, $__KC__$algorithm in Complexity Theory$__KC__$, $__KC__$Domain: Complexity Theory
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Randomized_Algorithms$__KC__$, 'other', 'connect'),
  ('graph_ridge_regression', $__KC__$Ridge Regression$__KC__$, $__KC__$Linear regression with L2 penalty: min ‖y − Xβ‖² + λ‖β‖²$__KC__$, $__KC__$Closed form: β̂ = (X^T X + λI)^{-1}X^T y — always invertible due to λI.
Shrinks coefficients toward zero but not to exactly zero.
MAP with Gaussian prior N(0, 1/2λ). Cross-validate to select λ.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Ridge_Regression$__KC__$, 'ml', 'connect'),
  ('graph_lasso_regression', $__KC__$Lasso Regression$__KC__$, $__KC__$Linear regression with L1 penalty: min ‖y − Xβ‖² + λ‖β‖₁ — induces sparsity$__KC__$, $__KC__$L1 penalty creates corners at 0 → many β_i = exactly 0 (automatic feature selection).
No closed form; solved via coordinate descent or proximal gradient.
MAP with Laplace prior. Elastic net = L1 + L2.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Lasso_Regression$__KC__$, 'ml', 'connect'),
  ('graph_roc_auc', $__KC__$ROC-AUC$__KC__$, $__KC__$ROC: plot TPR vs FPR at all thresholds; AUC = P(score(positive) > score(negative))$__KC__$, $__KC__$TPR (recall) = TP/(TP+FN). FPR = FP/(FP+TN).
AUC = 1: perfect. AUC = 0.5: random. Threshold-independent.
Prefer PR curve over ROC-AUC when class imbalance is severe.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/ROC-AUC$__KC__$, 'ml', 'understand'),
  ('graph_precision_recall', $__KC__$Precision-Recall$__KC__$, $__KC__$Precision = TP/(TP+FP): how many positives are correct. Recall = TP/(TP+FN): how many positives are found$__KC__$, $__KC__$F1 = 2·(P·R)/(P+R): harmonic mean balancing precision and recall.
High threshold → high precision, low recall. PR tradeoff visualized in PR curve.
Use when positive class is rare or false positives and false negatives have very different costs.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Precision-Recall$__KC__$, 'ml', 'understand'),
  ('graph_class_imbalance', $__KC__$Class Imbalance$__KC__$, $__KC__$Training data has heavily skewed class distribution; majority class dominates naive accuracy$__KC__$, $__KC__$Fixes: oversampling minority (SMOTE), undersampling majority, class-weighted loss.
Metrics: use F1, AUC-PR instead of accuracy.
Classifier biased toward majority without correction.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Class_Imbalance$__KC__$, 'ml', 'understand'),
  ('graph_hyperparameter_tuning', $__KC__$Hyperparameter Tuning$__KC__$, $__KC__$concept in Supervised Learning$__KC__$, $__KC__$Domain: Supervised Learning
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Hyperparameter_Tuning$__KC__$, 'ml', 'connect'),
  ('graph_probability_calibration', $__KC__$Probability Calibration$__KC__$, $__KC__$concept in Supervised Learning$__KC__$, $__KC__$Domain: Supervised Learning
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Probability_Calibration$__KC__$, 'ml', 'connect'),
  ('graph_xgboost', $__KC__$XGBoost$__KC__$, $__KC__$Extreme Gradient Boosting: regularized gradient boosting with 2nd-order Taylor expansion$__KC__$, $__KC__$Split gain = ½[G_L²/(H_L+λ) + G_R²/(H_R+λ) − (G_L+G_R)²/(H_L+H_R+λ)] − γ.
Handles missing values natively. Shrinkage η and column subsampling regularize.
State-of-art for tabular data. LightGBM: leaf-wise growth for speed.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/XGBoost$__KC__$, 'ml', 'connect'),
  ('graph_spectral_clustering', $__KC__$Spectral Clustering$__KC__$, $__KC__$algorithm in Unsupervised Learning$__KC__$, $__KC__$Domain: Unsupervised Learning
Difficulty: 4/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Spectral_Clustering$__KC__$, 'ml', 'apply'),
  ('graph_latent_variable_models', $__KC__$Latent Variable Models$__KC__$, $__KC__$concept in Unsupervised Learning$__KC__$, $__KC__$Domain: Unsupervised Learning
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Latent_Variable_Models$__KC__$, 'ml', 'apply'),
  ('graph_manifold_learning', $__KC__$Manifold Learning$__KC__$, $__KC__$concept in Unsupervised Learning$__KC__$, $__KC__$Domain: Unsupervised Learning
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Manifold_Learning$__KC__$, 'ml', 'apply'),
  ('graph_umap', $__KC__$UMAP$__KC__$, $__KC__$UMAP: Uniform Manifold Approximation — fast non-linear dimensionality reduction preserving global + local structure$__KC__$, $__KC__$Based on Riemannian geometry and algebraic topology. Faster than t-SNE at scale.
Preserves more global structure than t-SNE. Use for exploration and as preprocessing for downstream tasks.
Hyperparameters: n_neighbors, min_dist.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/UMAP$__KC__$, 'ml', 'connect'),
  ('graph_anomaly_detection', $__KC__$Anomaly Detection$__KC__$, $__KC__$Identify data points that deviate significantly from the expected pattern (outliers)$__KC__$, $__KC__$Methods: isolation forest, one-class SVM, autoencoders (high reconstruction error), DBSCAN noise points.
Applications: fraud detection, network intrusion, manufacturing defects.
Challenge: rare by definition → limited labeled examples; evaluation is hard.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Anomaly_Detection$__KC__$, 'ml', 'connect'),
  ('graph_isolation_forest', $__KC__$Isolation Forest$__KC__$, $__KC__$Anomaly detection via random feature-split trees; anomalies are isolated in fewer splits$__KC__$, $__KC__$Randomly select a feature and split value; repeat recursively.
Anomaly score = average path length to isolate a point (shorter = more anomalous).
O(n log n) training; efficient for high-dimensional data. No distance computation needed.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Isolation_Forest$__KC__$, 'ml', 'connect'),
  ('graph_self_supervised_learning', $__KC__$Self-Supervised Learning$__KC__$, $__KC__$Learn representations from unlabeled data using pretext tasks with automatically generated labels$__KC__$, $__KC__$Pretext tasks: masked prediction (BERT), contrastive pairs (SimCLR), rotation prediction.
No human annotation needed → scale to massive unlabeled datasets.
Representations transfer well to downstream tasks with few labeled examples.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Self-Supervised_Learning$__KC__$, 'ml', 'connect'),
  ('graph_contrastive_learning', $__KC__$Contrastive Learning$__KC__$, $__KC__$Learn representations by pulling similar (positive) pairs together and pushing dissimilar (negative) pairs apart$__KC__$, $__KC__$SimCLR InfoNCE: −log[exp(sim(z_i,z_j)/τ) / Σ_k exp(sim(z_i,z_k)/τ)].
Positive pairs: two augmented views of the same image. Negatives: other examples in batch.
Temperature τ controls concentration. CLIP: contrastive image-text pairs at scale.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Contrastive_Learning$__KC__$, 'ml', 'apply'),
  ('graph_monte_carlo_rl', $__KC__$Monte Carlo RL$__KC__$, $__KC__$algorithm in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Monte_Carlo_RL$__KC__$, 'ml', 'connect'),
  ('graph_sarsa', $__KC__$SARSA$__KC__$, $__KC__$algorithm in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/SARSA$__KC__$, 'ml', 'connect'),
  ('graph_epsilon_greedy', $__KC__$Epsilon-Greedy$__KC__$, $__KC__$algorithm in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 2/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Epsilon-Greedy$__KC__$, 'ml', 'understand'),
  ('graph_policy_iteration', $__KC__$Policy Iteration$__KC__$, $__KC__$algorithm in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Policy_Iteration$__KC__$, 'ml', 'connect'),
  ('graph_value_iteration', $__KC__$Value Iteration$__KC__$, $__KC__$algorithm in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: algorithm$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Value_Iteration$__KC__$, 'ml', 'connect'),
  ('graph_model_based_rl', $__KC__$Model-Based RL$__KC__$, $__KC__$concept in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Model-Based_RL$__KC__$, 'ml', 'apply'),
  ('graph_off_policy_learning', $__KC__$Off-Policy Learning$__KC__$, $__KC__$concept in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Off-Policy_Learning$__KC__$, 'ml', 'connect'),
  ('graph_on_policy_learning', $__KC__$On-Policy Learning$__KC__$, $__KC__$concept in Reinforcement Learning$__KC__$, $__KC__$Domain: Reinforcement Learning
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/On-Policy_Learning$__KC__$, 'ml', 'connect'),
  ('graph_mlp', $__KC__$Multilayer Perceptron$__KC__$, $__KC__$Multi-Layer Perceptron: stack of fully-connected layers with nonlinear activations$__KC__$, $__KC__$Layer l: a^l = σ(W^l a^{l-1} + b^l). Universal approximation with sufficient width.
No parameter sharing (unlike CNNs) → large parameter count for high-D inputs.
Baseline architecture for tabular data; used as feed-forward sublayer in Transformers.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Multilayer_Perceptron$__KC__$, 'ml', 'understand'),
  ('graph_convolution', $__KC__$Convolution$__KC__$, $__KC__$Sliding dot product of a learned filter over the input — detects local patterns regardless of position$__KC__$, $__KC__$Output size: (W − F + 2P)/S + 1 (W=input, F=filter, P=padding, S=stride).
Parameter sharing: same filter weights at every position → translational invariance.
Depthwise separable convolution (MobileNet) reduces parameters by ~8-9×.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Convolution$__KC__$, 'ml', 'understand'),
  ('graph_pooling', $__KC__$Pooling$__KC__$, $__KC__$Spatial downsampling to reduce feature map size and add translation invariance$__KC__$, $__KC__$Max pooling: take max in each window (most common). Average pooling: take mean.
Global average pooling: reduce each feature map to one scalar (replaces large FC layers).
Stride ≥ 2 in convolution is an alternative to explicit pooling.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Pooling$__KC__$, 'ml', 'understand'),
  ('graph_sequence_modeling', $__KC__$Sequence Modeling$__KC__$, $__KC__$concept in Deep Learning$__KC__$, $__KC__$Domain: Deep Learning
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sequence_Modeling$__KC__$, 'ml', 'connect'),
  ('graph_self_attention', $__KC__$Self-Attention$__KC__$, $__KC__$Attention where queries, keys, and values all come from the same sequence — each position attends to all others$__KC__$, $__KC__$output = softmax(QK^T/√d_k) V, Q=K=V = X W.
Captured all-pairs interactions: O(n²d) complexity.
Causal mask (−∞ above diagonal) for autoregressive decoding.
Foundation of Transformer encoder and decoder.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Self-Attention$__KC__$, 'ml', 'connect'),
  ('graph_masked_language_modeling', $__KC__$Masked Language Modeling$__KC__$, $__KC__$Pre-training task: mask ~15% of tokens; predict them given full bidirectional context$__KC__$, $__KC__$Masking strategy: 80% [MASK], 10% random token, 10% original.
Forces model to use both left and right context → bidirectional representations.
BERT: trained on MLM + NSP. RoBERTa: more data, no NSP. SpanBERT: masks spans.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Masked_Language_Modeling$__KC__$, 'ml', 'connect'),
  ('graph_instruction_tuning', $__KC__$Instruction Tuning$__KC__$, $__KC__$Fine-tune a pre-trained LLM on (instruction, response) pairs to follow natural language instructions$__KC__$, $__KC__$FLAN: fine-tuned on 100+ tasks phrased as instructions → better zero-shot generalization.
InstructGPT / ChatGPT: instruction tuning + RLHF for human-preferred responses.
Key insight: data quality and diversity > raw quantity for instruction following.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Instruction_Tuning$__KC__$, 'ml', 'connect'),
  ('graph_parameter_efficient_finetuning', $__KC__$Parameter-Efficient Fine-Tuning$__KC__$, $__KC__$Fine-tune only a small number of additional parameters while keeping most of the pre-trained model frozen$__KC__$, $__KC__$LoRA: add low-rank matrices ΔW = BA (r ≪ d). Only A,B are trained. Merge at inference.
Adapters: small bottleneck layers inserted between existing layers.
Prefix tuning: optimize soft prompt tokens prepended to input.
Reduces GPU memory and training time dramatically.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Parameter-Efficient_Fine-Tuning$__KC__$, 'ml', 'apply'),
  ('graph_mixture_of_experts', $__KC__$Mixture of Experts$__KC__$, $__KC__$model in Deep Learning$__KC__$, $__KC__$Domain: Deep Learning
Difficulty: 4/5
Type: model$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Mixture_of_Experts$__KC__$, 'ml', 'apply'),
  ('graph_rlhf', $__KC__$Reinforcement Learning from Human Feedback$__KC__$, $__KC__$RLHF: fine-tune an LLM using human preference rankings via a reward model and PPO$__KC__$, $__KC__$Step 1: supervised fine-tuning on human demonstrations.
Step 2: train reward model on human preference rankings.
Step 3: optimize LLM with PPO against reward model + KL penalty (prevents reward hacking).
Powers InstructGPT, ChatGPT, Claude.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Reinforcement_Learning_from_Human_Feedback$__KC__$, 'ml', 'apply'),
  ('graph_empirical_risk_minimization', $__KC__$Empirical Risk Minimization$__KC__$, $__KC__$Learn by minimizing the average loss on training data: min_{h∈H} (1/n) Σ L(h(x_i), y_i)$__KC__$, $__KC__$ERM is consistent: converges to Bayes optimal as n→∞ under realizability.
Generalization gap: |ERM risk − true risk| bounded by Rademacher complexity or VC dim.
Foundation of statistical learning theory and PAC learning.$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Empirical_Risk_Minimization$__KC__$, 'other', 'connect'),
  ('graph_structural_risk_minimization', $__KC__$Structural Risk Minimization$__KC__$, $__KC__$concept in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Structural_Risk_Minimization$__KC__$, 'other', 'apply'),
  ('graph_concentration_inequalities', $__KC__$Concentration Inequalities$__KC__$, $__KC__$concept in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Concentration_Inequalities$__KC__$, 'other', 'apply'),
  ('graph_chernoff_bound', $__KC__$Chernoff Bound$__KC__$, $__KC__$theorem in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 4/5
Type: theorem$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chernoff_Bound$__KC__$, 'other', 'apply'),
  ('graph_fano_inequality', $__KC__$Fano Inequality$__KC__$, $__KC__$theorem in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 5/5
Type: theorem$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Fano_Inequality$__KC__$, 'other', 'apply'),
  ('graph_pinsker_inequality', $__KC__$Pinsker Inequality$__KC__$, $__KC__$theorem in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 5/5
Type: theorem$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Pinsker_Inequality$__KC__$, 'other', 'apply'),
  ('graph_rate_distortion_theory', $__KC__$Rate-Distortion Theory$__KC__$, $__KC__$concept in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Rate-Distortion_Theory$__KC__$, 'other', 'apply'),
  ('graph_minimum_description_length', $__KC__$Minimum Description Length$__KC__$, $__KC__$concept in Theoretical ML$__KC__$, $__KC__$Domain: Theoretical ML
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Minimum_Description_Length$__KC__$, 'other', 'apply'),
  ('graph_ai_1', $__KC__$AI Topic 1$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_1$__KC__$, 'ml', 'understand'),
  ('graph_ai_2', $__KC__$AI Topic 2$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_2$__KC__$, 'ml', 'connect'),
  ('graph_ai_3', $__KC__$AI Topic 3$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_3$__KC__$, 'ml', 'apply'),
  ('graph_ai_4', $__KC__$AI Topic 4$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_4$__KC__$, 'ml', 'apply'),
  ('graph_ai_5', $__KC__$AI Topic 5$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_5$__KC__$, 'ml', 'memorize'),
  ('graph_ai_6', $__KC__$AI Topic 6$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_6$__KC__$, 'ml', 'understand'),
  ('graph_ai_7', $__KC__$AI Topic 7$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_7$__KC__$, 'ml', 'connect'),
  ('graph_ai_8', $__KC__$AI Topic 8$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_8$__KC__$, 'ml', 'apply'),
  ('graph_ai_9', $__KC__$AI Topic 9$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_9$__KC__$, 'ml', 'apply'),
  ('graph_ai_10', $__KC__$AI Topic 10$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_10$__KC__$, 'ml', 'memorize'),
  ('graph_adv_1', $__KC__$Sponsored Content 1$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_1$__KC__$, 'other', 'memorize'),
  ('graph_ai_11', $__KC__$AI Topic 11$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_11$__KC__$, 'ml', 'understand'),
  ('graph_ai_12', $__KC__$AI Topic 12$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_12$__KC__$, 'ml', 'connect'),
  ('graph_ai_13', $__KC__$AI Topic 13$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_13$__KC__$, 'ml', 'apply'),
  ('graph_ai_14', $__KC__$AI Topic 14$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_14$__KC__$, 'ml', 'apply'),
  ('graph_ai_15', $__KC__$AI Topic 15$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_15$__KC__$, 'ml', 'memorize'),
  ('graph_ai_16', $__KC__$AI Topic 16$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_16$__KC__$, 'ml', 'understand'),
  ('graph_ai_17', $__KC__$AI Topic 17$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_17$__KC__$, 'ml', 'connect'),
  ('graph_ai_18', $__KC__$AI Topic 18$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_18$__KC__$, 'ml', 'apply'),
  ('graph_ai_19', $__KC__$AI Topic 19$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_19$__KC__$, 'ml', 'apply'),
  ('graph_ai_20', $__KC__$AI Topic 20$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_20$__KC__$, 'ml', 'memorize'),
  ('graph_adv_2', $__KC__$Sponsored Content 2$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_2$__KC__$, 'other', 'memorize'),
  ('graph_ai_21', $__KC__$AI Topic 21$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_21$__KC__$, 'ml', 'understand'),
  ('graph_ai_22', $__KC__$AI Topic 22$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_22$__KC__$, 'ml', 'connect'),
  ('graph_ai_23', $__KC__$AI Topic 23$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_23$__KC__$, 'ml', 'apply'),
  ('graph_ai_24', $__KC__$AI Topic 24$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_24$__KC__$, 'ml', 'apply'),
  ('graph_ai_25', $__KC__$AI Topic 25$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_25$__KC__$, 'ml', 'memorize'),
  ('graph_ai_26', $__KC__$AI Topic 26$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_26$__KC__$, 'ml', 'understand'),
  ('graph_ai_27', $__KC__$AI Topic 27$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_27$__KC__$, 'ml', 'connect'),
  ('graph_ai_28', $__KC__$AI Topic 28$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_28$__KC__$, 'ml', 'apply'),
  ('graph_ai_29', $__KC__$AI Topic 29$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_29$__KC__$, 'ml', 'apply'),
  ('graph_ai_30', $__KC__$AI Topic 30$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_30$__KC__$, 'ml', 'memorize'),
  ('graph_adv_3', $__KC__$Sponsored Content 3$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_3$__KC__$, 'other', 'memorize'),
  ('graph_ai_31', $__KC__$AI Topic 31$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_31$__KC__$, 'ml', 'understand'),
  ('graph_ai_32', $__KC__$AI Topic 32$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_32$__KC__$, 'ml', 'connect'),
  ('graph_ai_33', $__KC__$AI Topic 33$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_33$__KC__$, 'ml', 'apply'),
  ('graph_ai_34', $__KC__$AI Topic 34$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_34$__KC__$, 'ml', 'apply'),
  ('graph_ai_35', $__KC__$AI Topic 35$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_35$__KC__$, 'ml', 'memorize'),
  ('graph_ai_36', $__KC__$AI Topic 36$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_36$__KC__$, 'ml', 'understand'),
  ('graph_ai_37', $__KC__$AI Topic 37$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_37$__KC__$, 'ml', 'connect'),
  ('graph_ai_38', $__KC__$AI Topic 38$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_38$__KC__$, 'ml', 'apply'),
  ('graph_ai_39', $__KC__$AI Topic 39$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_39$__KC__$, 'ml', 'apply'),
  ('graph_ai_40', $__KC__$AI Topic 40$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_40$__KC__$, 'ml', 'memorize'),
  ('graph_adv_4', $__KC__$Sponsored Content 4$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_4$__KC__$, 'other', 'memorize'),
  ('graph_ai_41', $__KC__$AI Topic 41$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_41$__KC__$, 'ml', 'understand'),
  ('graph_ai_42', $__KC__$AI Topic 42$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_42$__KC__$, 'ml', 'connect'),
  ('graph_ai_43', $__KC__$AI Topic 43$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_43$__KC__$, 'ml', 'apply'),
  ('graph_ai_44', $__KC__$AI Topic 44$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_44$__KC__$, 'ml', 'apply'),
  ('graph_ai_45', $__KC__$AI Topic 45$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_45$__KC__$, 'ml', 'memorize'),
  ('graph_ai_46', $__KC__$AI Topic 46$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_46$__KC__$, 'ml', 'understand'),
  ('graph_ai_47', $__KC__$AI Topic 47$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_47$__KC__$, 'ml', 'connect'),
  ('graph_ai_48', $__KC__$AI Topic 48$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_48$__KC__$, 'ml', 'apply'),
  ('graph_ai_49', $__KC__$AI Topic 49$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_49$__KC__$, 'ml', 'apply'),
  ('graph_ai_50', $__KC__$AI Topic 50$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_50$__KC__$, 'ml', 'memorize'),
  ('graph_adv_5', $__KC__$Sponsored Content 5$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_5$__KC__$, 'other', 'memorize'),
  ('graph_ai_51', $__KC__$AI Topic 51$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_51$__KC__$, 'ml', 'understand'),
  ('graph_ai_52', $__KC__$AI Topic 52$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_52$__KC__$, 'ml', 'connect'),
  ('graph_ai_53', $__KC__$AI Topic 53$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_53$__KC__$, 'ml', 'apply'),
  ('graph_ai_54', $__KC__$AI Topic 54$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_54$__KC__$, 'ml', 'apply'),
  ('graph_ai_55', $__KC__$AI Topic 55$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_55$__KC__$, 'ml', 'memorize'),
  ('graph_ai_56', $__KC__$AI Topic 56$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_56$__KC__$, 'ml', 'understand'),
  ('graph_ai_57', $__KC__$AI Topic 57$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_57$__KC__$, 'ml', 'connect'),
  ('graph_ai_58', $__KC__$AI Topic 58$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_58$__KC__$, 'ml', 'apply'),
  ('graph_ai_59', $__KC__$AI Topic 59$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_59$__KC__$, 'ml', 'apply'),
  ('graph_ai_60', $__KC__$AI Topic 60$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_60$__KC__$, 'ml', 'memorize'),
  ('graph_adv_6', $__KC__$Sponsored Content 6$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_6$__KC__$, 'other', 'memorize'),
  ('graph_ai_61', $__KC__$AI Topic 61$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_61$__KC__$, 'ml', 'understand'),
  ('graph_ai_62', $__KC__$AI Topic 62$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_62$__KC__$, 'ml', 'connect'),
  ('graph_ai_63', $__KC__$AI Topic 63$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_63$__KC__$, 'ml', 'apply'),
  ('graph_ai_64', $__KC__$AI Topic 64$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_64$__KC__$, 'ml', 'apply'),
  ('graph_ai_65', $__KC__$AI Topic 65$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_65$__KC__$, 'ml', 'memorize'),
  ('graph_ai_66', $__KC__$AI Topic 66$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_66$__KC__$, 'ml', 'understand'),
  ('graph_ai_67', $__KC__$AI Topic 67$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_67$__KC__$, 'ml', 'connect'),
  ('graph_ai_68', $__KC__$AI Topic 68$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_68$__KC__$, 'ml', 'apply'),
  ('graph_ai_69', $__KC__$AI Topic 69$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_69$__KC__$, 'ml', 'apply'),
  ('graph_ai_70', $__KC__$AI Topic 70$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_70$__KC__$, 'ml', 'memorize'),
  ('graph_adv_7', $__KC__$Sponsored Content 7$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_7$__KC__$, 'other', 'memorize'),
  ('graph_ai_71', $__KC__$AI Topic 71$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_71$__KC__$, 'ml', 'understand'),
  ('graph_ai_72', $__KC__$AI Topic 72$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_72$__KC__$, 'ml', 'connect'),
  ('graph_ai_73', $__KC__$AI Topic 73$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_73$__KC__$, 'ml', 'apply'),
  ('graph_ai_74', $__KC__$AI Topic 74$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_74$__KC__$, 'ml', 'apply'),
  ('graph_ai_75', $__KC__$AI Topic 75$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_75$__KC__$, 'ml', 'memorize'),
  ('graph_ai_76', $__KC__$AI Topic 76$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_76$__KC__$, 'ml', 'understand'),
  ('graph_ai_77', $__KC__$AI Topic 77$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_77$__KC__$, 'ml', 'connect'),
  ('graph_ai_78', $__KC__$AI Topic 78$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_78$__KC__$, 'ml', 'apply'),
  ('graph_ai_79', $__KC__$AI Topic 79$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_79$__KC__$, 'ml', 'apply'),
  ('graph_ai_80', $__KC__$AI Topic 80$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_80$__KC__$, 'ml', 'memorize'),
  ('graph_adv_8', $__KC__$Sponsored Content 8$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_8$__KC__$, 'other', 'memorize'),
  ('graph_ai_81', $__KC__$AI Topic 81$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_81$__KC__$, 'ml', 'understand'),
  ('graph_ai_82', $__KC__$AI Topic 82$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_82$__KC__$, 'ml', 'connect'),
  ('graph_ai_83', $__KC__$AI Topic 83$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_83$__KC__$, 'ml', 'apply'),
  ('graph_ai_84', $__KC__$AI Topic 84$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_84$__KC__$, 'ml', 'apply'),
  ('graph_ai_85', $__KC__$AI Topic 85$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_85$__KC__$, 'ml', 'memorize'),
  ('graph_ai_86', $__KC__$AI Topic 86$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_86$__KC__$, 'ml', 'understand'),
  ('graph_ai_87', $__KC__$AI Topic 87$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_87$__KC__$, 'ml', 'connect'),
  ('graph_ai_88', $__KC__$AI Topic 88$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_88$__KC__$, 'ml', 'apply'),
  ('graph_ai_89', $__KC__$AI Topic 89$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_89$__KC__$, 'ml', 'apply'),
  ('graph_ai_90', $__KC__$AI Topic 90$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_90$__KC__$, 'ml', 'memorize'),
  ('graph_adv_9', $__KC__$Sponsored Content 9$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_9$__KC__$, 'other', 'memorize'),
  ('graph_ai_91', $__KC__$AI Topic 91$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_91$__KC__$, 'ml', 'understand'),
  ('graph_ai_92', $__KC__$AI Topic 92$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_92$__KC__$, 'ml', 'connect'),
  ('graph_ai_93', $__KC__$AI Topic 93$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_93$__KC__$, 'ml', 'apply'),
  ('graph_ai_94', $__KC__$AI Topic 94$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_94$__KC__$, 'ml', 'apply'),
  ('graph_ai_95', $__KC__$AI Topic 95$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_95$__KC__$, 'ml', 'memorize'),
  ('graph_ai_96', $__KC__$AI Topic 96$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_96$__KC__$, 'ml', 'understand'),
  ('graph_ai_97', $__KC__$AI Topic 97$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_97$__KC__$, 'ml', 'connect'),
  ('graph_ai_98', $__KC__$AI Topic 98$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_98$__KC__$, 'ml', 'apply'),
  ('graph_ai_99', $__KC__$AI Topic 99$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_99$__KC__$, 'ml', 'apply'),
  ('graph_ai_100', $__KC__$AI Topic 100$__KC__$, $__KC__$concept in Artificial Intelligence$__KC__$, $__KC__$Domain: Artificial Intelligence
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/AI_Topic_100$__KC__$, 'ml', 'memorize'),
  ('graph_adv_10', $__KC__$Sponsored Content 10$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_10$__KC__$, 'other', 'memorize'),
  ('graph_chem_1', $__KC__$Chemistry Topic 1$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_1$__KC__$, 'other', 'understand'),
  ('graph_chem_2', $__KC__$Chemistry Topic 2$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_2$__KC__$, 'other', 'connect'),
  ('graph_chem_3', $__KC__$Chemistry Topic 3$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_3$__KC__$, 'other', 'apply'),
  ('graph_chem_4', $__KC__$Chemistry Topic 4$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_4$__KC__$, 'other', 'apply'),
  ('graph_chem_5', $__KC__$Chemistry Topic 5$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_5$__KC__$, 'other', 'memorize'),
  ('graph_chem_6', $__KC__$Chemistry Topic 6$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_6$__KC__$, 'other', 'understand'),
  ('graph_chem_7', $__KC__$Chemistry Topic 7$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_7$__KC__$, 'other', 'connect'),
  ('graph_chem_8', $__KC__$Chemistry Topic 8$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_8$__KC__$, 'other', 'apply'),
  ('graph_chem_9', $__KC__$Chemistry Topic 9$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_9$__KC__$, 'other', 'apply'),
  ('graph_chem_10', $__KC__$Chemistry Topic 10$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_10$__KC__$, 'other', 'memorize'),
  ('graph_adv_11', $__KC__$Sponsored Content 11$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_11$__KC__$, 'other', 'memorize'),
  ('graph_chem_11', $__KC__$Chemistry Topic 11$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_11$__KC__$, 'other', 'understand'),
  ('graph_chem_12', $__KC__$Chemistry Topic 12$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_12$__KC__$, 'other', 'connect'),
  ('graph_chem_13', $__KC__$Chemistry Topic 13$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_13$__KC__$, 'other', 'apply'),
  ('graph_chem_14', $__KC__$Chemistry Topic 14$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_14$__KC__$, 'other', 'apply'),
  ('graph_chem_15', $__KC__$Chemistry Topic 15$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_15$__KC__$, 'other', 'memorize'),
  ('graph_chem_16', $__KC__$Chemistry Topic 16$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_16$__KC__$, 'other', 'understand'),
  ('graph_chem_17', $__KC__$Chemistry Topic 17$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_17$__KC__$, 'other', 'connect'),
  ('graph_chem_18', $__KC__$Chemistry Topic 18$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_18$__KC__$, 'other', 'apply'),
  ('graph_chem_19', $__KC__$Chemistry Topic 19$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_19$__KC__$, 'other', 'apply'),
  ('graph_chem_20', $__KC__$Chemistry Topic 20$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_20$__KC__$, 'other', 'memorize'),
  ('graph_adv_12', $__KC__$Sponsored Content 12$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_12$__KC__$, 'other', 'memorize'),
  ('graph_chem_21', $__KC__$Chemistry Topic 21$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_21$__KC__$, 'other', 'understand'),
  ('graph_chem_22', $__KC__$Chemistry Topic 22$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_22$__KC__$, 'other', 'connect'),
  ('graph_chem_23', $__KC__$Chemistry Topic 23$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_23$__KC__$, 'other', 'apply'),
  ('graph_chem_24', $__KC__$Chemistry Topic 24$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_24$__KC__$, 'other', 'apply'),
  ('graph_chem_25', $__KC__$Chemistry Topic 25$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_25$__KC__$, 'other', 'memorize'),
  ('graph_chem_26', $__KC__$Chemistry Topic 26$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_26$__KC__$, 'other', 'understand'),
  ('graph_chem_27', $__KC__$Chemistry Topic 27$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_27$__KC__$, 'other', 'connect'),
  ('graph_chem_28', $__KC__$Chemistry Topic 28$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_28$__KC__$, 'other', 'apply'),
  ('graph_chem_29', $__KC__$Chemistry Topic 29$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_29$__KC__$, 'other', 'apply'),
  ('graph_chem_30', $__KC__$Chemistry Topic 30$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_30$__KC__$, 'other', 'memorize'),
  ('graph_adv_13', $__KC__$Sponsored Content 13$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_13$__KC__$, 'other', 'memorize'),
  ('graph_chem_31', $__KC__$Chemistry Topic 31$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_31$__KC__$, 'other', 'understand'),
  ('graph_chem_32', $__KC__$Chemistry Topic 32$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_32$__KC__$, 'other', 'connect'),
  ('graph_chem_33', $__KC__$Chemistry Topic 33$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_33$__KC__$, 'other', 'apply'),
  ('graph_chem_34', $__KC__$Chemistry Topic 34$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_34$__KC__$, 'other', 'apply'),
  ('graph_chem_35', $__KC__$Chemistry Topic 35$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_35$__KC__$, 'other', 'memorize'),
  ('graph_chem_36', $__KC__$Chemistry Topic 36$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_36$__KC__$, 'other', 'understand'),
  ('graph_chem_37', $__KC__$Chemistry Topic 37$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_37$__KC__$, 'other', 'connect'),
  ('graph_chem_38', $__KC__$Chemistry Topic 38$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_38$__KC__$, 'other', 'apply'),
  ('graph_chem_39', $__KC__$Chemistry Topic 39$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_39$__KC__$, 'other', 'apply'),
  ('graph_chem_40', $__KC__$Chemistry Topic 40$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_40$__KC__$, 'other', 'memorize')
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO knowledge_cards (id, title, summary, explanation, wiki_url, domain, level) VALUES
  ('graph_adv_14', $__KC__$Sponsored Content 14$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_14$__KC__$, 'other', 'memorize'),
  ('graph_chem_41', $__KC__$Chemistry Topic 41$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_41$__KC__$, 'other', 'understand'),
  ('graph_chem_42', $__KC__$Chemistry Topic 42$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_42$__KC__$, 'other', 'connect'),
  ('graph_chem_43', $__KC__$Chemistry Topic 43$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_43$__KC__$, 'other', 'apply'),
  ('graph_chem_44', $__KC__$Chemistry Topic 44$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_44$__KC__$, 'other', 'apply'),
  ('graph_chem_45', $__KC__$Chemistry Topic 45$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_45$__KC__$, 'other', 'memorize'),
  ('graph_chem_46', $__KC__$Chemistry Topic 46$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_46$__KC__$, 'other', 'understand'),
  ('graph_chem_47', $__KC__$Chemistry Topic 47$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_47$__KC__$, 'other', 'connect'),
  ('graph_chem_48', $__KC__$Chemistry Topic 48$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_48$__KC__$, 'other', 'apply'),
  ('graph_chem_49', $__KC__$Chemistry Topic 49$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_49$__KC__$, 'other', 'apply'),
  ('graph_chem_50', $__KC__$Chemistry Topic 50$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_50$__KC__$, 'other', 'memorize'),
  ('graph_adv_15', $__KC__$Sponsored Content 15$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_15$__KC__$, 'other', 'memorize'),
  ('graph_chem_51', $__KC__$Chemistry Topic 51$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_51$__KC__$, 'other', 'understand'),
  ('graph_chem_52', $__KC__$Chemistry Topic 52$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_52$__KC__$, 'other', 'connect'),
  ('graph_chem_53', $__KC__$Chemistry Topic 53$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_53$__KC__$, 'other', 'apply'),
  ('graph_chem_54', $__KC__$Chemistry Topic 54$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_54$__KC__$, 'other', 'apply'),
  ('graph_chem_55', $__KC__$Chemistry Topic 55$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_55$__KC__$, 'other', 'memorize'),
  ('graph_chem_56', $__KC__$Chemistry Topic 56$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_56$__KC__$, 'other', 'understand'),
  ('graph_chem_57', $__KC__$Chemistry Topic 57$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_57$__KC__$, 'other', 'connect'),
  ('graph_chem_58', $__KC__$Chemistry Topic 58$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_58$__KC__$, 'other', 'apply'),
  ('graph_chem_59', $__KC__$Chemistry Topic 59$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_59$__KC__$, 'other', 'apply'),
  ('graph_chem_60', $__KC__$Chemistry Topic 60$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_60$__KC__$, 'other', 'memorize'),
  ('graph_adv_16', $__KC__$Sponsored Content 16$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_16$__KC__$, 'other', 'memorize'),
  ('graph_chem_61', $__KC__$Chemistry Topic 61$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_61$__KC__$, 'other', 'understand'),
  ('graph_chem_62', $__KC__$Chemistry Topic 62$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_62$__KC__$, 'other', 'connect'),
  ('graph_chem_63', $__KC__$Chemistry Topic 63$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_63$__KC__$, 'other', 'apply'),
  ('graph_chem_64', $__KC__$Chemistry Topic 64$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_64$__KC__$, 'other', 'apply'),
  ('graph_chem_65', $__KC__$Chemistry Topic 65$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_65$__KC__$, 'other', 'memorize'),
  ('graph_chem_66', $__KC__$Chemistry Topic 66$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_66$__KC__$, 'other', 'understand'),
  ('graph_chem_67', $__KC__$Chemistry Topic 67$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_67$__KC__$, 'other', 'connect'),
  ('graph_chem_68', $__KC__$Chemistry Topic 68$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_68$__KC__$, 'other', 'apply'),
  ('graph_chem_69', $__KC__$Chemistry Topic 69$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_69$__KC__$, 'other', 'apply'),
  ('graph_chem_70', $__KC__$Chemistry Topic 70$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_70$__KC__$, 'other', 'memorize'),
  ('graph_adv_17', $__KC__$Sponsored Content 17$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_17$__KC__$, 'other', 'memorize'),
  ('graph_chem_71', $__KC__$Chemistry Topic 71$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_71$__KC__$, 'other', 'understand'),
  ('graph_chem_72', $__KC__$Chemistry Topic 72$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_72$__KC__$, 'other', 'connect'),
  ('graph_chem_73', $__KC__$Chemistry Topic 73$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_73$__KC__$, 'other', 'apply'),
  ('graph_chem_74', $__KC__$Chemistry Topic 74$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_74$__KC__$, 'other', 'apply'),
  ('graph_chem_75', $__KC__$Chemistry Topic 75$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_75$__KC__$, 'other', 'memorize'),
  ('graph_chem_76', $__KC__$Chemistry Topic 76$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_76$__KC__$, 'other', 'understand'),
  ('graph_chem_77', $__KC__$Chemistry Topic 77$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_77$__KC__$, 'other', 'connect'),
  ('graph_chem_78', $__KC__$Chemistry Topic 78$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_78$__KC__$, 'other', 'apply'),
  ('graph_chem_79', $__KC__$Chemistry Topic 79$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_79$__KC__$, 'other', 'apply'),
  ('graph_chem_80', $__KC__$Chemistry Topic 80$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_80$__KC__$, 'other', 'memorize'),
  ('graph_adv_18', $__KC__$Sponsored Content 18$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_18$__KC__$, 'other', 'memorize'),
  ('graph_chem_81', $__KC__$Chemistry Topic 81$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_81$__KC__$, 'other', 'understand'),
  ('graph_chem_82', $__KC__$Chemistry Topic 82$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_82$__KC__$, 'other', 'connect'),
  ('graph_chem_83', $__KC__$Chemistry Topic 83$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_83$__KC__$, 'other', 'apply'),
  ('graph_chem_84', $__KC__$Chemistry Topic 84$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_84$__KC__$, 'other', 'apply'),
  ('graph_chem_85', $__KC__$Chemistry Topic 85$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_85$__KC__$, 'other', 'memorize'),
  ('graph_chem_86', $__KC__$Chemistry Topic 86$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_86$__KC__$, 'other', 'understand'),
  ('graph_chem_87', $__KC__$Chemistry Topic 87$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_87$__KC__$, 'other', 'connect'),
  ('graph_chem_88', $__KC__$Chemistry Topic 88$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_88$__KC__$, 'other', 'apply'),
  ('graph_chem_89', $__KC__$Chemistry Topic 89$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_89$__KC__$, 'other', 'apply'),
  ('graph_chem_90', $__KC__$Chemistry Topic 90$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_90$__KC__$, 'other', 'memorize'),
  ('graph_adv_19', $__KC__$Sponsored Content 19$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_19$__KC__$, 'other', 'memorize'),
  ('graph_chem_91', $__KC__$Chemistry Topic 91$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_91$__KC__$, 'other', 'understand'),
  ('graph_chem_92', $__KC__$Chemistry Topic 92$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_92$__KC__$, 'other', 'connect'),
  ('graph_chem_93', $__KC__$Chemistry Topic 93$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_93$__KC__$, 'other', 'apply'),
  ('graph_chem_94', $__KC__$Chemistry Topic 94$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_94$__KC__$, 'other', 'apply'),
  ('graph_chem_95', $__KC__$Chemistry Topic 95$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_95$__KC__$, 'other', 'memorize'),
  ('graph_chem_96', $__KC__$Chemistry Topic 96$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_96$__KC__$, 'other', 'understand'),
  ('graph_chem_97', $__KC__$Chemistry Topic 97$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_97$__KC__$, 'other', 'connect'),
  ('graph_chem_98', $__KC__$Chemistry Topic 98$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_98$__KC__$, 'other', 'apply'),
  ('graph_chem_99', $__KC__$Chemistry Topic 99$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_99$__KC__$, 'other', 'apply'),
  ('graph_chem_100', $__KC__$Chemistry Topic 100$__KC__$, $__KC__$concept in Chemistry$__KC__$, $__KC__$Domain: Chemistry
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Chemistry_Topic_100$__KC__$, 'other', 'memorize'),
  ('graph_adv_20', $__KC__$Sponsored Content 20$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_20$__KC__$, 'other', 'memorize'),
  ('graph_bio_1', $__KC__$Biology Topic 1$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_1$__KC__$, 'other', 'understand'),
  ('graph_bio_2', $__KC__$Biology Topic 2$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_2$__KC__$, 'other', 'connect'),
  ('graph_bio_3', $__KC__$Biology Topic 3$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_3$__KC__$, 'other', 'apply'),
  ('graph_bio_4', $__KC__$Biology Topic 4$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_4$__KC__$, 'other', 'apply'),
  ('graph_bio_5', $__KC__$Biology Topic 5$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_5$__KC__$, 'other', 'memorize'),
  ('graph_bio_6', $__KC__$Biology Topic 6$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_6$__KC__$, 'other', 'understand'),
  ('graph_bio_7', $__KC__$Biology Topic 7$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_7$__KC__$, 'other', 'connect'),
  ('graph_bio_8', $__KC__$Biology Topic 8$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_8$__KC__$, 'other', 'apply'),
  ('graph_bio_9', $__KC__$Biology Topic 9$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_9$__KC__$, 'other', 'apply'),
  ('graph_bio_10', $__KC__$Biology Topic 10$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_10$__KC__$, 'other', 'memorize'),
  ('graph_adv_21', $__KC__$Sponsored Content 21$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_21$__KC__$, 'other', 'memorize'),
  ('graph_bio_11', $__KC__$Biology Topic 11$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_11$__KC__$, 'other', 'understand'),
  ('graph_bio_12', $__KC__$Biology Topic 12$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_12$__KC__$, 'other', 'connect'),
  ('graph_bio_13', $__KC__$Biology Topic 13$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_13$__KC__$, 'other', 'apply'),
  ('graph_bio_14', $__KC__$Biology Topic 14$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_14$__KC__$, 'other', 'apply'),
  ('graph_bio_15', $__KC__$Biology Topic 15$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_15$__KC__$, 'other', 'memorize'),
  ('graph_bio_16', $__KC__$Biology Topic 16$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_16$__KC__$, 'other', 'understand'),
  ('graph_bio_17', $__KC__$Biology Topic 17$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_17$__KC__$, 'other', 'connect'),
  ('graph_bio_18', $__KC__$Biology Topic 18$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_18$__KC__$, 'other', 'apply'),
  ('graph_bio_19', $__KC__$Biology Topic 19$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_19$__KC__$, 'other', 'apply'),
  ('graph_bio_20', $__KC__$Biology Topic 20$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_20$__KC__$, 'other', 'memorize'),
  ('graph_adv_22', $__KC__$Sponsored Content 22$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_22$__KC__$, 'other', 'memorize'),
  ('graph_bio_21', $__KC__$Biology Topic 21$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_21$__KC__$, 'other', 'understand'),
  ('graph_bio_22', $__KC__$Biology Topic 22$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_22$__KC__$, 'other', 'connect'),
  ('graph_bio_23', $__KC__$Biology Topic 23$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_23$__KC__$, 'other', 'apply'),
  ('graph_bio_24', $__KC__$Biology Topic 24$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_24$__KC__$, 'other', 'apply'),
  ('graph_bio_25', $__KC__$Biology Topic 25$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_25$__KC__$, 'other', 'memorize'),
  ('graph_bio_26', $__KC__$Biology Topic 26$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_26$__KC__$, 'other', 'understand'),
  ('graph_bio_27', $__KC__$Biology Topic 27$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_27$__KC__$, 'other', 'connect'),
  ('graph_bio_28', $__KC__$Biology Topic 28$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_28$__KC__$, 'other', 'apply'),
  ('graph_bio_29', $__KC__$Biology Topic 29$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_29$__KC__$, 'other', 'apply'),
  ('graph_bio_30', $__KC__$Biology Topic 30$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_30$__KC__$, 'other', 'memorize'),
  ('graph_adv_23', $__KC__$Sponsored Content 23$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_23$__KC__$, 'other', 'memorize'),
  ('graph_bio_31', $__KC__$Biology Topic 31$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_31$__KC__$, 'other', 'understand'),
  ('graph_bio_32', $__KC__$Biology Topic 32$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_32$__KC__$, 'other', 'connect'),
  ('graph_bio_33', $__KC__$Biology Topic 33$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_33$__KC__$, 'other', 'apply'),
  ('graph_bio_34', $__KC__$Biology Topic 34$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_34$__KC__$, 'other', 'apply'),
  ('graph_bio_35', $__KC__$Biology Topic 35$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_35$__KC__$, 'other', 'memorize'),
  ('graph_bio_36', $__KC__$Biology Topic 36$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_36$__KC__$, 'other', 'understand'),
  ('graph_bio_37', $__KC__$Biology Topic 37$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_37$__KC__$, 'other', 'connect'),
  ('graph_bio_38', $__KC__$Biology Topic 38$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_38$__KC__$, 'other', 'apply'),
  ('graph_bio_39', $__KC__$Biology Topic 39$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_39$__KC__$, 'other', 'apply'),
  ('graph_bio_40', $__KC__$Biology Topic 40$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_40$__KC__$, 'other', 'memorize'),
  ('graph_adv_24', $__KC__$Sponsored Content 24$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_24$__KC__$, 'other', 'memorize'),
  ('graph_bio_41', $__KC__$Biology Topic 41$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_41$__KC__$, 'other', 'understand'),
  ('graph_bio_42', $__KC__$Biology Topic 42$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_42$__KC__$, 'other', 'connect'),
  ('graph_bio_43', $__KC__$Biology Topic 43$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_43$__KC__$, 'other', 'apply'),
  ('graph_bio_44', $__KC__$Biology Topic 44$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_44$__KC__$, 'other', 'apply'),
  ('graph_bio_45', $__KC__$Biology Topic 45$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_45$__KC__$, 'other', 'memorize'),
  ('graph_bio_46', $__KC__$Biology Topic 46$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_46$__KC__$, 'other', 'understand'),
  ('graph_bio_47', $__KC__$Biology Topic 47$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_47$__KC__$, 'other', 'connect'),
  ('graph_bio_48', $__KC__$Biology Topic 48$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_48$__KC__$, 'other', 'apply'),
  ('graph_bio_49', $__KC__$Biology Topic 49$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_49$__KC__$, 'other', 'apply'),
  ('graph_bio_50', $__KC__$Biology Topic 50$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_50$__KC__$, 'other', 'memorize'),
  ('graph_adv_25', $__KC__$Sponsored Content 25$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_25$__KC__$, 'other', 'memorize'),
  ('graph_bio_51', $__KC__$Biology Topic 51$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_51$__KC__$, 'other', 'understand'),
  ('graph_bio_52', $__KC__$Biology Topic 52$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_52$__KC__$, 'other', 'connect'),
  ('graph_bio_53', $__KC__$Biology Topic 53$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_53$__KC__$, 'other', 'apply'),
  ('graph_bio_54', $__KC__$Biology Topic 54$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_54$__KC__$, 'other', 'apply'),
  ('graph_bio_55', $__KC__$Biology Topic 55$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_55$__KC__$, 'other', 'memorize'),
  ('graph_bio_56', $__KC__$Biology Topic 56$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_56$__KC__$, 'other', 'understand'),
  ('graph_bio_57', $__KC__$Biology Topic 57$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_57$__KC__$, 'other', 'connect'),
  ('graph_bio_58', $__KC__$Biology Topic 58$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_58$__KC__$, 'other', 'apply'),
  ('graph_bio_59', $__KC__$Biology Topic 59$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_59$__KC__$, 'other', 'apply'),
  ('graph_bio_60', $__KC__$Biology Topic 60$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_60$__KC__$, 'other', 'memorize'),
  ('graph_adv_26', $__KC__$Sponsored Content 26$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_26$__KC__$, 'other', 'memorize'),
  ('graph_bio_61', $__KC__$Biology Topic 61$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_61$__KC__$, 'other', 'understand'),
  ('graph_bio_62', $__KC__$Biology Topic 62$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_62$__KC__$, 'other', 'connect'),
  ('graph_bio_63', $__KC__$Biology Topic 63$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_63$__KC__$, 'other', 'apply'),
  ('graph_bio_64', $__KC__$Biology Topic 64$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_64$__KC__$, 'other', 'apply'),
  ('graph_bio_65', $__KC__$Biology Topic 65$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_65$__KC__$, 'other', 'memorize'),
  ('graph_bio_66', $__KC__$Biology Topic 66$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_66$__KC__$, 'other', 'understand'),
  ('graph_bio_67', $__KC__$Biology Topic 67$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_67$__KC__$, 'other', 'connect'),
  ('graph_bio_68', $__KC__$Biology Topic 68$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_68$__KC__$, 'other', 'apply'),
  ('graph_bio_69', $__KC__$Biology Topic 69$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_69$__KC__$, 'other', 'apply'),
  ('graph_bio_70', $__KC__$Biology Topic 70$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_70$__KC__$, 'other', 'memorize'),
  ('graph_adv_27', $__KC__$Sponsored Content 27$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_27$__KC__$, 'other', 'memorize'),
  ('graph_bio_71', $__KC__$Biology Topic 71$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_71$__KC__$, 'other', 'understand'),
  ('graph_bio_72', $__KC__$Biology Topic 72$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_72$__KC__$, 'other', 'connect'),
  ('graph_bio_73', $__KC__$Biology Topic 73$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_73$__KC__$, 'other', 'apply'),
  ('graph_bio_74', $__KC__$Biology Topic 74$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_74$__KC__$, 'other', 'apply'),
  ('graph_bio_75', $__KC__$Biology Topic 75$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_75$__KC__$, 'other', 'memorize'),
  ('graph_bio_76', $__KC__$Biology Topic 76$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_76$__KC__$, 'other', 'understand'),
  ('graph_bio_77', $__KC__$Biology Topic 77$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_77$__KC__$, 'other', 'connect'),
  ('graph_bio_78', $__KC__$Biology Topic 78$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_78$__KC__$, 'other', 'apply'),
  ('graph_bio_79', $__KC__$Biology Topic 79$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_79$__KC__$, 'other', 'apply'),
  ('graph_bio_80', $__KC__$Biology Topic 80$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_80$__KC__$, 'other', 'memorize'),
  ('graph_adv_28', $__KC__$Sponsored Content 28$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_28$__KC__$, 'other', 'memorize'),
  ('graph_bio_81', $__KC__$Biology Topic 81$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_81$__KC__$, 'other', 'understand'),
  ('graph_bio_82', $__KC__$Biology Topic 82$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_82$__KC__$, 'other', 'connect'),
  ('graph_bio_83', $__KC__$Biology Topic 83$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_83$__KC__$, 'other', 'apply'),
  ('graph_bio_84', $__KC__$Biology Topic 84$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_84$__KC__$, 'other', 'apply'),
  ('graph_bio_85', $__KC__$Biology Topic 85$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_85$__KC__$, 'other', 'memorize'),
  ('graph_bio_86', $__KC__$Biology Topic 86$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_86$__KC__$, 'other', 'understand'),
  ('graph_bio_87', $__KC__$Biology Topic 87$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_87$__KC__$, 'other', 'connect'),
  ('graph_bio_88', $__KC__$Biology Topic 88$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_88$__KC__$, 'other', 'apply'),
  ('graph_bio_89', $__KC__$Biology Topic 89$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_89$__KC__$, 'other', 'apply'),
  ('graph_bio_90', $__KC__$Biology Topic 90$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_90$__KC__$, 'other', 'memorize'),
  ('graph_adv_29', $__KC__$Sponsored Content 29$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_29$__KC__$, 'other', 'memorize'),
  ('graph_bio_91', $__KC__$Biology Topic 91$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_91$__KC__$, 'other', 'understand'),
  ('graph_bio_92', $__KC__$Biology Topic 92$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_92$__KC__$, 'other', 'connect'),
  ('graph_bio_93', $__KC__$Biology Topic 93$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_93$__KC__$, 'other', 'apply'),
  ('graph_bio_94', $__KC__$Biology Topic 94$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_94$__KC__$, 'other', 'apply'),
  ('graph_bio_95', $__KC__$Biology Topic 95$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_95$__KC__$, 'other', 'memorize'),
  ('graph_bio_96', $__KC__$Biology Topic 96$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 2/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_96$__KC__$, 'other', 'understand'),
  ('graph_bio_97', $__KC__$Biology Topic 97$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 3/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_97$__KC__$, 'other', 'connect'),
  ('graph_bio_98', $__KC__$Biology Topic 98$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 4/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_98$__KC__$, 'other', 'apply'),
  ('graph_bio_99', $__KC__$Biology Topic 99$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 5/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_99$__KC__$, 'other', 'apply'),
  ('graph_bio_100', $__KC__$Biology Topic 100$__KC__$, $__KC__$concept in Biology$__KC__$, $__KC__$Domain: Biology
Difficulty: 1/5
Type: concept$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Biology_Topic_100$__KC__$, 'other', 'memorize'),
  ('graph_adv_30', $__KC__$Sponsored Content 30$__KC__$, $__KC__$advertisement in Misc$__KC__$, $__KC__$Domain: Misc
Difficulty: 1/5
Type: advertisement$__KC__$, $__KC__$https://en.wikipedia.org/wiki/Sponsored_Content_30$__KC__$, 'other', 'memorize')
ON CONFLICT (id) DO NOTHING;
