import type { GraphEdge } from '@/lib/graph-types';

// ============================================================
// AI/CS Knowledge Graph — Edge Definitions
// Edge types: prerequisite, related, generalizes, derived_from, equivalent_to
// ============================================================

export const GRAPH_EDGES: GraphEdge[] = [
  // ============================================================
  // META ROOT → LEVEL 1 (generalizes)
  // ============================================================
  { source: 'mathematics', target: 'linear_algebra', type: 'generalizes', weight: 1.0 },
  { source: 'mathematics', target: 'probability_statistics', type: 'generalizes', weight: 1.0 },
  { source: 'mathematics', target: 'optimization', type: 'generalizes', weight: 1.0 },
  { source: 'mathematics', target: 'calculus', type: 'generalizes', weight: 1.0 },
  { source: 'computer_science', target: 'algorithms', type: 'generalizes', weight: 1.0 },
  { source: 'computer_science', target: 'data_structures', type: 'generalizes', weight: 1.0 },
  { source: 'computer_science', target: 'complexity_theory', type: 'generalizes', weight: 1.0 },
  { source: 'machine_learning', target: 'supervised_learning', type: 'generalizes', weight: 1.0 },
  { source: 'machine_learning', target: 'unsupervised_learning', type: 'generalizes', weight: 1.0 },
  { source: 'machine_learning', target: 'reinforcement_learning', type: 'generalizes', weight: 1.0 },
  { source: 'machine_learning', target: 'theoretical_ml', type: 'generalizes', weight: 1.0 },
  { source: 'artificial_intelligence', target: 'deep_learning', type: 'generalizes', weight: 1.0 },
  { source: 'artificial_intelligence', target: 'machine_learning', type: 'generalizes', weight: 1.0 },

  // ============================================================
  // LINEAR ALGEBRA — internal prerequisites
  // ============================================================
  { source: 'vector_spaces', target: 'linear_transformations', type: 'prerequisite', weight: 0.9 },
  { source: 'vector_spaces', target: 'norm', type: 'prerequisite', weight: 0.7 },
  { source: 'matrix_multiplication', target: 'matrix_inverse', type: 'prerequisite', weight: 0.8 },
  { source: 'matrix_multiplication', target: 'determinant', type: 'prerequisite', weight: 0.8 },
  { source: 'matrix_multiplication', target: 'eigenvalues_eigenvectors', type: 'prerequisite', weight: 0.9 },
  { source: 'matrix_multiplication', target: 'linear_transformations', type: 'prerequisite', weight: 0.8 },
  { source: 'eigenvalues_eigenvectors', target: 'svd', type: 'prerequisite', weight: 0.9 },
  { source: 'vector_spaces', target: 'orthogonality', type: 'prerequisite', weight: 0.8 },
  { source: 'orthogonality', target: 'least_squares', type: 'prerequisite', weight: 0.8 },
  { source: 'matrix_inverse', target: 'least_squares', type: 'prerequisite', weight: 0.7 },
  { source: 'eigenvalues_eigenvectors', target: 'matrix_factorization', type: 'prerequisite', weight: 0.8 },
  { source: 'eigenvalues_eigenvectors', target: 'positive_definite_matrices', type: 'prerequisite', weight: 0.8 },
  { source: 'determinant', target: 'eigenvalues_eigenvectors', type: 'prerequisite', weight: 0.7 },
  { source: 'svd', target: 'matrix_factorization', type: 'related', weight: 0.8 },
  { source: 'norm', target: 'orthogonality', type: 'related', weight: 0.6 },

  // ============================================================
  // PROBABILITY & STATISTICS — internal prerequisites
  // ============================================================
  { source: 'random_variables', target: 'expectation', type: 'prerequisite', weight: 0.9 },
  { source: 'random_variables', target: 'variance', type: 'prerequisite', weight: 0.9 },
  { source: 'random_variables', target: 'probability_distributions', type: 'prerequisite', weight: 0.9 },
  { source: 'conditional_probability', target: 'bayes_theorem', type: 'prerequisite', weight: 0.9 },
  { source: 'bayes_theorem', target: 'bayesian_inference', type: 'prerequisite', weight: 0.9 },
  { source: 'bayes_theorem', target: 'maximum_likelihood_estimation', type: 'prerequisite', weight: 0.7 },
  { source: 'probability_distributions', target: 'gaussian_distribution', type: 'prerequisite', weight: 0.8 },
  { source: 'expectation', target: 'variance', type: 'prerequisite', weight: 0.8 },
  { source: 'expectation', target: 'covariance', type: 'prerequisite', weight: 0.8 },
  { source: 'variance', target: 'covariance', type: 'prerequisite', weight: 0.7 },
  { source: 'gaussian_distribution', target: 'central_limit_theorem', type: 'prerequisite', weight: 0.8 },
  { source: 'random_variables', target: 'law_of_large_numbers', type: 'prerequisite', weight: 0.7 },
  { source: 'bayesian_inference', target: 'map_estimation', type: 'prerequisite', weight: 0.8 },
  { source: 'maximum_likelihood_estimation', target: 'map_estimation', type: 'related', weight: 0.8 },
  { source: 'conditional_probability', target: 'markov_chains', type: 'prerequisite', weight: 0.8 },
  { source: 'hypothesis_testing', target: 'cross_validation', type: 'related', weight: 0.5 },

  // ============================================================
  // OPTIMIZATION — internal prerequisites
  // ============================================================
  { source: 'gradient', target: 'gradient_descent', type: 'prerequisite', weight: 0.9 },
  { source: 'partial_derivatives', target: 'gradient_descent', type: 'prerequisite', weight: 0.9 },
  { source: 'gradient_descent', target: 'stochastic_gradient_descent', type: 'prerequisite', weight: 0.9 },
  { source: 'gradient_descent', target: 'convex_optimization', type: 'prerequisite', weight: 0.7 },
  { source: 'convex_optimization', target: 'lagrange_multipliers', type: 'prerequisite', weight: 0.8 },
  { source: 'lagrange_multipliers', target: 'duality', type: 'prerequisite', weight: 0.9 },
  { source: 'stochastic_gradient_descent', target: 'adam_optimizer', type: 'prerequisite', weight: 0.8 },
  { source: 'gradient_descent', target: 'learning_rate', type: 'prerequisite', weight: 0.7 },
  { source: 'stochastic_gradient_descent', target: 'momentum', type: 'prerequisite', weight: 0.8 },
  { source: 'loss_function', target: 'gradient_descent', type: 'prerequisite', weight: 0.8 },
  { source: 'loss_function', target: 'cross_entropy_loss', type: 'prerequisite', weight: 0.7 },

  // ============================================================
  // CALCULUS — internal prerequisites
  // ============================================================
  { source: 'partial_derivatives', target: 'gradient', type: 'prerequisite', weight: 0.9 },
  { source: 'partial_derivatives', target: 'chain_rule', type: 'related', weight: 0.8 },
  { source: 'partial_derivatives', target: 'jacobian', type: 'prerequisite', weight: 0.8 },
  { source: 'jacobian', target: 'hessian', type: 'prerequisite', weight: 0.8 },
  { source: 'partial_derivatives', target: 'taylor_expansion', type: 'prerequisite', weight: 0.7 },
  { source: 'partial_derivatives', target: 'multivariable_calculus', type: 'prerequisite', weight: 0.8 },
  { source: 'integration', target: 'multivariable_calculus', type: 'prerequisite', weight: 0.7 },

  // ============================================================
  // ALGORITHMS — internal prerequisites
  // ============================================================
  { source: 'sorting', target: 'divide_and_conquer', type: 'related', weight: 0.6 },
  { source: 'binary_search', target: 'divide_and_conquer', type: 'related', weight: 0.5 },
  { source: 'graphs_ds', target: 'graph_algorithms', type: 'prerequisite', weight: 0.9 },
  { source: 'graph_algorithms', target: 'bfs', type: 'prerequisite', weight: 0.8 },
  { source: 'graph_algorithms', target: 'dfs', type: 'prerequisite', weight: 0.8 },
  { source: 'graph_algorithms', target: 'dijkstra', type: 'prerequisite', weight: 0.8 },
  { source: 'greedy_algorithms', target: 'dijkstra', type: 'related', weight: 0.6 },
  { source: 'dfs', target: 'backtracking', type: 'prerequisite', weight: 0.7 },

  // ============================================================
  // DATA STRUCTURES — internal prerequisites
  // ============================================================
  { source: 'linked_lists', target: 'trees', type: 'prerequisite', weight: 0.6 },
  { source: 'trees', target: 'binary_search_tree', type: 'prerequisite', weight: 0.8 },
  { source: 'trees', target: 'heaps', type: 'prerequisite', weight: 0.7 },
  { source: 'stacks_queues', target: 'bfs', type: 'prerequisite', weight: 0.6 },
  { source: 'stacks_queues', target: 'dfs', type: 'prerequisite', weight: 0.6 },
  { source: 'trees', target: 'trie', type: 'prerequisite', weight: 0.7 },

  // ============================================================
  // COMPLEXITY THEORY — internal prerequisites
  // ============================================================
  { source: 'big_o_notation', target: 'time_complexity', type: 'prerequisite', weight: 0.9 },
  { source: 'big_o_notation', target: 'space_complexity', type: 'prerequisite', weight: 0.9 },
  { source: 'time_complexity', target: 'p_vs_np', type: 'prerequisite', weight: 0.8 },
  { source: 'p_vs_np', target: 'np_completeness', type: 'prerequisite', weight: 0.9 },

  // ============================================================
  // SUPERVISED LEARNING — internal prerequisites
  // ============================================================
  { source: 'linear_regression', target: 'logistic_regression', type: 'prerequisite', weight: 0.8 },
  { source: 'logistic_regression', target: 'svm', type: 'prerequisite', weight: 0.7 },
  { source: 'decision_tree', target: 'random_forest', type: 'prerequisite', weight: 0.9 },
  { source: 'decision_tree', target: 'gradient_boosting', type: 'prerequisite', weight: 0.8 },
  { source: 'random_forest', target: 'ensemble_methods', type: 'related', weight: 0.7 },
  { source: 'gradient_boosting', target: 'ensemble_methods', type: 'related', weight: 0.7 },
  { source: 'bayes_theorem', target: 'naive_bayes', type: 'prerequisite', weight: 0.8 },
  { source: 'overfitting', target: 'cross_validation', type: 'prerequisite', weight: 0.7 },
  { source: 'overfitting', target: 'regularization', type: 'prerequisite', weight: 0.8 },
  { source: 'bias_variance_tradeoff', target: 'overfitting', type: 'prerequisite', weight: 0.8 },

  // ============================================================
  // UNSUPERVISED LEARNING — internal prerequisites
  // ============================================================
  { source: 'k_means', target: 'dbscan', type: 'related', weight: 0.5 },
  { source: 'k_means', target: 'hierarchical_clustering', type: 'related', weight: 0.5 },
  { source: 'pca', target: 'dimensionality_reduction', type: 'related', weight: 0.8 },
  { source: 'gaussian_distribution', target: 'gaussian_mixture_models', type: 'prerequisite', weight: 0.8 },
  { source: 'gaussian_mixture_models', target: 'em_algorithm', type: 'prerequisite', weight: 0.9 },
  { source: 'maximum_likelihood_estimation', target: 'em_algorithm', type: 'prerequisite', weight: 0.7 },
  { source: 'svd', target: 'pca', type: 'prerequisite', weight: 0.8 },
  { source: 'eigenvalues_eigenvectors', target: 'pca', type: 'prerequisite', weight: 0.9 },
  { source: 'dimensionality_reduction', target: 't_sne', type: 'prerequisite', weight: 0.6 },
  { source: 'neural_networks', target: 'autoencoder', type: 'prerequisite', weight: 0.8 },

  // ============================================================
  // REINFORCEMENT LEARNING — internal prerequisites
  // ============================================================
  { source: 'markov_chains', target: 'mdp', type: 'prerequisite', weight: 0.9 },
  { source: 'mdp', target: 'bellman_equation', type: 'prerequisite', weight: 0.9 },
  { source: 'mdp', target: 'value_function', type: 'prerequisite', weight: 0.9 },
  { source: 'bellman_equation', target: 'q_learning', type: 'prerequisite', weight: 0.9 },
  { source: 'value_function', target: 'q_learning', type: 'prerequisite', weight: 0.8 },
  { source: 'value_function', target: 'temporal_difference', type: 'prerequisite', weight: 0.8 },
  { source: 'policy_gradient', target: 'actor_critic', type: 'prerequisite', weight: 0.8 },
  { source: 'value_function', target: 'actor_critic', type: 'prerequisite', weight: 0.7 },
  { source: 'q_learning', target: 'exploration_exploitation', type: 'related', weight: 0.6 },
  { source: 'gradient_descent', target: 'policy_gradient', type: 'prerequisite', weight: 0.7 },

  // ============================================================
  // DEEP LEARNING — internal prerequisites
  // ============================================================
  { source: 'neural_networks', target: 'backpropagation', type: 'prerequisite', weight: 0.9 },
  { source: 'chain_rule', target: 'backpropagation', type: 'prerequisite', weight: 0.9 },
  { source: 'neural_networks', target: 'activation_functions', type: 'prerequisite', weight: 0.8 },
  { source: 'activation_functions', target: 'relu', type: 'prerequisite', weight: 0.7 },
  { source: 'activation_functions', target: 'sigmoid', type: 'prerequisite', weight: 0.7 },
  { source: 'activation_functions', target: 'softmax', type: 'prerequisite', weight: 0.7 },
  { source: 'neural_networks', target: 'weight_initialization', type: 'prerequisite', weight: 0.7 },
  { source: 'backpropagation', target: 'vanishing_gradient', type: 'prerequisite', weight: 0.8 },
  { source: 'neural_networks', target: 'cnn', type: 'prerequisite', weight: 0.8 },
  { source: 'neural_networks', target: 'rnn', type: 'prerequisite', weight: 0.8 },
  { source: 'rnn', target: 'lstm', type: 'prerequisite', weight: 0.9 },
  { source: 'vanishing_gradient', target: 'lstm', type: 'prerequisite', weight: 0.8 },
  { source: 'attention_mechanism', target: 'transformer', type: 'prerequisite', weight: 0.9 },
  { source: 'attention_mechanism', target: 'multi_head_attention', type: 'prerequisite', weight: 0.9 },
  { source: 'multi_head_attention', target: 'transformer', type: 'prerequisite', weight: 0.8 },
  { source: 'positional_encoding', target: 'transformer', type: 'prerequisite', weight: 0.8 },
  { source: 'layer_normalization', target: 'transformer', type: 'prerequisite', weight: 0.6 },
  { source: 'residual_connections', target: 'transformer', type: 'prerequisite', weight: 0.7 },
  { source: 'vanishing_gradient', target: 'residual_connections', type: 'prerequisite', weight: 0.7 },
  { source: 'regularization', target: 'dropout', type: 'prerequisite', weight: 0.7 },
  { source: 'regularization', target: 'batch_normalization', type: 'related', weight: 0.6 },
  { source: 'batch_normalization', target: 'layer_normalization', type: 'related', weight: 0.7 },
  { source: 'transformer', target: 'bert', type: 'prerequisite', weight: 0.9 },
  { source: 'transformer', target: 'gpt', type: 'prerequisite', weight: 0.9 },
  { source: 'neural_networks', target: 'gan', type: 'prerequisite', weight: 0.8 },
  { source: 'neural_networks', target: 'vae', type: 'prerequisite', weight: 0.8 },
  { source: 'kl_divergence', target: 'vae', type: 'prerequisite', weight: 0.7 },
  { source: 'bayesian_inference', target: 'vae', type: 'prerequisite', weight: 0.6 },
  { source: 'transfer_learning', target: 'fine_tuning', type: 'prerequisite', weight: 0.9 },
  { source: 'neural_networks', target: 'embeddings', type: 'prerequisite', weight: 0.7 },
  { source: 'embeddings', target: 'word2vec', type: 'prerequisite', weight: 0.8 },
  { source: 'embeddings', target: 'positional_encoding', type: 'related', weight: 0.5 },
  { source: 'neural_networks', target: 'diffusion_models', type: 'prerequisite', weight: 0.7 },
  { source: 'gaussian_distribution', target: 'diffusion_models', type: 'prerequisite', weight: 0.6 },
  { source: 'sigmoid', target: 'logistic_regression', type: 'prerequisite', weight: 0.7 },
  { source: 'softmax', target: 'cross_entropy_loss', type: 'related', weight: 0.7 },
  { source: 'cross_entropy_loss', target: 'logistic_regression', type: 'related', weight: 0.6 },

  // ============================================================
  // THEORETICAL ML — internal prerequisites
  // ============================================================
  { source: 'vc_dimension', target: 'pac_learning', type: 'prerequisite', weight: 0.8 },
  { source: 'vc_dimension', target: 'generalization_bounds', type: 'prerequisite', weight: 0.8 },
  { source: 'pac_learning', target: 'statistical_learning_theory', type: 'prerequisite', weight: 0.8 },
  { source: 'rademacher_complexity', target: 'generalization_bounds', type: 'prerequisite', weight: 0.8 },
  { source: 'information_theory', target: 'entropy', type: 'prerequisite', weight: 0.9 },
  { source: 'entropy', target: 'kl_divergence', type: 'prerequisite', weight: 0.8 },
  { source: 'entropy', target: 'mutual_information', type: 'prerequisite', weight: 0.8 },
  { source: 'kl_divergence', target: 'mutual_information', type: 'related', weight: 0.7 },
  { source: 'bias_variance_tradeoff', target: 'no_free_lunch', type: 'related', weight: 0.5 },

  // ============================================================
  // CROSS-DOMAIN edges (Mathematics → ML/DL/CS)
  // ============================================================

  // Linear Algebra → ML/DL
  { source: 'linear_regression', target: 'least_squares', type: 'derived_from', weight: 0.9 },
  { source: 'matrix_multiplication', target: 'neural_networks', type: 'prerequisite', weight: 0.8 },
  { source: 'eigenvalues_eigenvectors', target: 'pca', type: 'prerequisite', weight: 0.9 },
  { source: 'svd', target: 'dimensionality_reduction', type: 'prerequisite', weight: 0.7 },
  { source: 'linear_algebra', target: 'supervised_learning', type: 'prerequisite', weight: 0.7 },
  { source: 'positive_definite_matrices', target: 'convex_optimization', type: 'prerequisite', weight: 0.6 },

  // Probability → ML
  { source: 'probability_statistics', target: 'supervised_learning', type: 'prerequisite', weight: 0.8 },
  { source: 'probability_statistics', target: 'unsupervised_learning', type: 'prerequisite', weight: 0.7 },
  { source: 'maximum_likelihood_estimation', target: 'linear_regression', type: 'prerequisite', weight: 0.7 },
  { source: 'maximum_likelihood_estimation', target: 'logistic_regression', type: 'prerequisite', weight: 0.8 },
  { source: 'gaussian_distribution', target: 'naive_bayes', type: 'prerequisite', weight: 0.6 },
  { source: 'markov_chains', target: 'reinforcement_learning', type: 'prerequisite', weight: 0.8 },

  // Optimization → ML/DL
  { source: 'gradient_descent', target: 'linear_regression', type: 'prerequisite', weight: 0.7 },
  { source: 'gradient_descent', target: 'neural_networks', type: 'prerequisite', weight: 0.9 },
  { source: 'stochastic_gradient_descent', target: 'neural_networks', type: 'prerequisite', weight: 0.8 },
  { source: 'convex_optimization', target: 'svm', type: 'prerequisite', weight: 0.8 },
  { source: 'duality', target: 'svm', type: 'prerequisite', weight: 0.7 },
  { source: 'loss_function', target: 'neural_networks', type: 'prerequisite', weight: 0.8 },
  { source: 'optimization', target: 'deep_learning', type: 'prerequisite', weight: 0.8 },

  // Calculus → ML/DL
  { source: 'calculus', target: 'optimization', type: 'prerequisite', weight: 0.9 },
  { source: 'chain_rule', target: 'backpropagation', type: 'prerequisite', weight: 0.9 },
  { source: 'gradient', target: 'neural_networks', type: 'prerequisite', weight: 0.7 },
  { source: 'hessian', target: 'convex_optimization', type: 'related', weight: 0.6 },

  // CS → ML
  { source: 'algorithms', target: 'machine_learning', type: 'prerequisite', weight: 0.6 },
  { source: 'data_structures', target: 'machine_learning', type: 'prerequisite', weight: 0.5 },
  { source: 'dynamic_programming', target: 'bellman_equation', type: 'related', weight: 0.7 },
  { source: 'graph_algorithms', target: 'graph_algorithms', type: 'related', weight: 0.0 }, // self-reference removed below
  { source: 'big_o_notation', target: 'algorithms', type: 'prerequisite', weight: 0.7 },

  // Information Theory → DL
  { source: 'entropy', target: 'cross_entropy_loss', type: 'prerequisite', weight: 0.8 },
  { source: 'kl_divergence', target: 'vae', type: 'prerequisite', weight: 0.8 },
  { source: 'information_theory', target: 'decision_tree', type: 'related', weight: 0.5 },

  // Theoretical ML → practical ML
  { source: 'bias_variance_tradeoff', target: 'regularization', type: 'prerequisite', weight: 0.7 },
  { source: 'vc_dimension', target: 'svm', type: 'related', weight: 0.6 },
  { source: 'generalization_bounds', target: 'overfitting', type: 'related', weight: 0.6 },

  // ============================================================
  // EXTENDED CORE edges
  // ============================================================

  // Linear Algebra extensions
  { source: 'matrix_multiplication', target: 'rank', type: 'prerequisite', weight: 0.7 },
  { source: 'matrix_multiplication', target: 'null_space', type: 'prerequisite', weight: 0.7 },
  { source: 'matrix_multiplication', target: 'column_space', type: 'prerequisite', weight: 0.7 },
  { source: 'vector_spaces', target: 'change_of_basis', type: 'prerequisite', weight: 0.8 },
  { source: 'orthogonality', target: 'orthonormal_basis', type: 'prerequisite', weight: 0.8 },
  { source: 'least_squares', target: 'projection_matrix', type: 'prerequisite', weight: 0.7 },
  { source: 'eigenvalues_eigenvectors', target: 'spectral_theorem', type: 'prerequisite', weight: 0.9 },
  { source: 'svd', target: 'moore_penrose_pseudoinverse', type: 'prerequisite', weight: 0.8 },

  // Probability & Statistics extensions
  { source: 'probability_distributions', target: 'bernoulli_distribution', type: 'prerequisite', weight: 0.7 },
  { source: 'bernoulli_distribution', target: 'binomial_distribution', type: 'prerequisite', weight: 0.8 },
  { source: 'probability_distributions', target: 'poisson_distribution', type: 'prerequisite', weight: 0.7 },
  { source: 'probability_distributions', target: 'exponential_distribution', type: 'prerequisite', weight: 0.7 },
  { source: 'random_variables', target: 'sampling_methods', type: 'prerequisite', weight: 0.6 },
  { source: 'sampling_methods', target: 'monte_carlo_methods', type: 'prerequisite', weight: 0.8 },
  { source: 'variance', target: 'confidence_interval', type: 'prerequisite', weight: 0.7 },
  { source: 'hypothesis_testing', target: 'a_b_testing', type: 'prerequisite', weight: 0.8 },

  // Optimization extensions
  { source: 'convex_optimization', target: 'constrained_optimization', type: 'prerequisite', weight: 0.8 },
  { source: 'constrained_optimization', target: 'projected_gradient_descent', type: 'prerequisite', weight: 0.8 },
  { source: 'gradient_descent', target: 'newton_method', type: 'related', weight: 0.6 },
  { source: 'gradient_descent', target: 'line_search', type: 'prerequisite', weight: 0.7 },
  { source: 'regularization', target: 'l1_regularization', type: 'derived_from', weight: 0.7 },
  { source: 'regularization', target: 'l2_regularization', type: 'derived_from', weight: 0.7 },
  { source: 'l1_regularization', target: 'proximal_gradient', type: 'prerequisite', weight: 0.8 },
  { source: 'duality', target: 'kkt_conditions', type: 'prerequisite', weight: 0.8 },

  // Calculus extensions
  { source: 'limits', target: 'continuity', type: 'prerequisite', weight: 0.8 },
  { source: 'chain_rule', target: 'multivariate_chain_rule', type: 'generalizes', weight: 0.8 },
  { source: 'gradient', target: 'directional_derivative', type: 'prerequisite', weight: 0.7 },
  { source: 'jacobian', target: 'jacobian_determinant', type: 'prerequisite', weight: 0.8 },
  { source: 'partial_derivatives', target: 'implicit_function_theorem', type: 'prerequisite', weight: 0.7 },

  // Algorithms extensions
  { source: 'dijkstra', target: 'shortest_path_algorithms', type: 'generalizes', weight: 0.8 },
  { source: 'bellman_ford', target: 'shortest_path_algorithms', type: 'generalizes', weight: 0.8 },
  { source: 'graphs_ds', target: 'minimum_spanning_tree', type: 'prerequisite', weight: 0.8 },
  { source: 'graph_algorithms', target: 'topological_sort', type: 'prerequisite', weight: 0.8 },
  { source: 'dynamic_programming', target: 'floyd_warshall', type: 'prerequisite', weight: 0.8 },
  { source: 'graphs_ds', target: 'bellman_ford', type: 'prerequisite', weight: 0.7 },
  { source: 'disjoint_set', target: 'union_find', type: 'equivalent_to', weight: 0.9 },
  { source: 'time_complexity', target: 'amortized_analysis', type: 'prerequisite', weight: 0.7 },
  { source: 'algorithms', target: 'string_matching', type: 'generalizes', weight: 0.6 },

  // Data Structures extensions
  { source: 'graphs_ds', target: 'adjacency_list', type: 'prerequisite', weight: 0.8 },
  { source: 'heaps', target: 'priority_queue', type: 'equivalent_to', weight: 0.7 },
  { source: 'trees', target: 'segment_tree', type: 'prerequisite', weight: 0.7 },
  { source: 'segment_tree', target: 'fenwick_tree', type: 'related', weight: 0.6 },
  { source: 'trees', target: 'b_tree', type: 'prerequisite', weight: 0.7 },
  { source: 'hash_tables', target: 'bloom_filter', type: 'prerequisite', weight: 0.6 },

  // Complexity extensions
  { source: 'decision_problem', target: 'reduction', type: 'prerequisite', weight: 0.7 },
  { source: 'polynomial_time', target: 'p_vs_np', type: 'prerequisite', weight: 0.8 },
  { source: 'nondeterminism', target: 'p_vs_np', type: 'prerequisite', weight: 0.8 },
  { source: 'np_completeness', target: 'approximation_algorithms', type: 'related', weight: 0.6 },
  { source: 'random_variables', target: 'randomized_algorithms', type: 'prerequisite', weight: 0.6 },

  // Supervised Learning extensions
  { source: 'linear_regression', target: 'ridge_regression', type: 'prerequisite', weight: 0.8 },
  { source: 'linear_regression', target: 'lasso_regression', type: 'prerequisite', weight: 0.8 },
  { source: 'logistic_regression', target: 'roc_auc', type: 'related', weight: 0.7 },
  { source: 'logistic_regression', target: 'precision_recall', type: 'related', weight: 0.7 },
  { source: 'precision_recall', target: 'class_imbalance', type: 'related', weight: 0.8 },
  { source: 'cross_validation', target: 'hyperparameter_tuning', type: 'prerequisite', weight: 0.8 },
  { source: 'logistic_regression', target: 'probability_calibration', type: 'prerequisite', weight: 0.7 },
  { source: 'gradient_boosting', target: 'xgboost', type: 'derived_from', weight: 0.8 },

  // Unsupervised Learning extensions
  { source: 'eigenvalues_eigenvectors', target: 'spectral_clustering', type: 'prerequisite', weight: 0.8 },
  { source: 'gaussian_mixture_models', target: 'latent_variable_models', type: 'related', weight: 0.8 },
  { source: 'dimensionality_reduction', target: 'manifold_learning', type: 'prerequisite', weight: 0.7 },
  { source: 'manifold_learning', target: 'umap', type: 'derived_from', weight: 0.7 },
  { source: 'unsupervised_learning', target: 'anomaly_detection', type: 'generalizes', weight: 0.7 },
  { source: 'anomaly_detection', target: 'isolation_forest', type: 'prerequisite', weight: 0.8 },
  { source: 'autoencoder', target: 'self_supervised_learning', type: 'related', weight: 0.6 },
  { source: 'self_supervised_learning', target: 'contrastive_learning', type: 'prerequisite', weight: 0.8 },

  // Reinforcement Learning extensions
  { source: 'value_function', target: 'monte_carlo_rl', type: 'prerequisite', weight: 0.7 },
  { source: 'q_learning', target: 'sarsa', type: 'related', weight: 0.7 },
  { source: 'exploration_exploitation', target: 'epsilon_greedy', type: 'prerequisite', weight: 0.8 },
  { source: 'bellman_equation', target: 'policy_iteration', type: 'prerequisite', weight: 0.8 },
  { source: 'bellman_equation', target: 'value_iteration', type: 'prerequisite', weight: 0.8 },
  { source: 'mdp', target: 'model_based_rl', type: 'prerequisite', weight: 0.8 },
  { source: 'q_learning', target: 'off_policy_learning', type: 'generalizes', weight: 0.8 },
  { source: 'policy_gradient', target: 'on_policy_learning', type: 'generalizes', weight: 0.8 },

  // Deep Learning extensions
  { source: 'neural_networks', target: 'mlp', type: 'generalizes', weight: 0.8 },
  { source: 'cnn', target: 'convolution', type: 'derived_from', weight: 0.8 },
  { source: 'cnn', target: 'pooling', type: 'prerequisite', weight: 0.7 },
  { source: 'rnn', target: 'sequence_modeling', type: 'generalizes', weight: 0.8 },
  { source: 'attention_mechanism', target: 'self_attention', type: 'prerequisite', weight: 0.8 },
  { source: 'bert', target: 'masked_language_modeling', type: 'derived_from', weight: 0.8 },
  { source: 'fine_tuning', target: 'instruction_tuning', type: 'derived_from', weight: 0.8 },
  { source: 'fine_tuning', target: 'parameter_efficient_finetuning', type: 'derived_from', weight: 0.8 },
  { source: 'transformer', target: 'mixture_of_experts', type: 'prerequisite', weight: 0.7 },
  { source: 'reinforcement_learning', target: 'rlhf', type: 'prerequisite', weight: 0.8 },
  { source: 'instruction_tuning', target: 'rlhf', type: 'prerequisite', weight: 0.7 },

  // Theoretical ML extensions
  { source: 'statistical_learning_theory', target: 'empirical_risk_minimization', type: 'generalizes', weight: 0.7 },
  { source: 'empirical_risk_minimization', target: 'structural_risk_minimization', type: 'prerequisite', weight: 0.8 },
  { source: 'probability_statistics', target: 'concentration_inequalities', type: 'prerequisite', weight: 0.7 },
  { source: 'concentration_inequalities', target: 'chernoff_bound', type: 'generalizes', weight: 0.8 },
  { source: 'information_theory', target: 'fano_inequality', type: 'prerequisite', weight: 0.8 },
  { source: 'kl_divergence', target: 'pinsker_inequality', type: 'prerequisite', weight: 0.8 },
  { source: 'information_theory', target: 'rate_distortion_theory', type: 'prerequisite', weight: 0.8 },
  { source: 'entropy', target: 'minimum_description_length', type: 'prerequisite', weight: 0.8 },
].filter((e): e is GraphEdge => e.source !== e.target); // Remove any accidental self-references

// Export edge count for reference
export const EDGE_COUNT = GRAPH_EDGES.length;
