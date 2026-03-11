import type { GraphNode } from '@/lib/graph-types';

// ============================================================
// AI/CS Knowledge Graph — Core Nodes (~200 nodes)
// Organized by domain hierarchy
// ============================================================

export const GRAPH_NODES: GraphNode[] = [
  // ============================================================
  // LEVEL 0 — Meta Roots (4 nodes)
  // ============================================================
  { id: 'mathematics', label: 'Mathematics', domain: 'Mathematics', level: 0, difficulty: 1, type: 'concept' },
  { id: 'computer_science', label: 'Computer Science', domain: 'Computer Science', level: 0, difficulty: 1, type: 'concept' },
  { id: 'machine_learning', label: 'Machine Learning', domain: 'Machine Learning', level: 0, difficulty: 1, type: 'concept' },
  { id: 'artificial_intelligence', label: 'Artificial Intelligence', domain: 'Artificial Intelligence', level: 0, difficulty: 1, type: 'concept' },

  // ============================================================
  // LEVEL 1 — Mathematics Core
  // ============================================================

  // --- Linear Algebra (parent) ---
  { id: 'linear_algebra', label: 'Linear Algebra', domain: 'Linear Algebra', level: 1, difficulty: 2, type: 'concept' },
  { id: 'vector_spaces', label: 'Vector Spaces', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'concept' },
  { id: 'matrix_multiplication', label: 'Matrix Multiplication', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'eigenvalues_eigenvectors', label: 'Eigenvalues & Eigenvectors', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'svd', label: 'Singular Value Decomposition', domain: 'Linear Algebra', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'matrix_inverse', label: 'Matrix Inverse', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'concept' },
  { id: 'determinant', label: 'Determinant', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'concept' },
  { id: 'linear_transformations', label: 'Linear Transformations', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'orthogonality', label: 'Orthogonality', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'least_squares', label: 'Least Squares', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'matrix_factorization', label: 'Matrix Factorization', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'positive_definite_matrices', label: 'Positive Definite Matrices', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'norm', label: 'Norm', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'concept' },

  // --- Probability & Statistics (parent) ---
  { id: 'probability_statistics', label: 'Probability & Statistics', domain: 'Probability & Statistics', level: 1, difficulty: 2, type: 'concept' },
  { id: 'random_variables', label: 'Random Variables', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'expectation', label: 'Expectation', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'variance', label: 'Variance', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'bayes_theorem', label: 'Bayes Theorem', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'theorem' },
  { id: 'maximum_likelihood_estimation', label: 'Maximum Likelihood Estimation', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'concept' },
  { id: 'conditional_probability', label: 'Conditional Probability', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'probability_distributions', label: 'Probability Distributions', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'gaussian_distribution', label: 'Gaussian Distribution', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'law_of_large_numbers', label: 'Law of Large Numbers', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'theorem' },
  { id: 'central_limit_theorem', label: 'Central Limit Theorem', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'theorem' },
  { id: 'covariance', label: 'Covariance', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'hypothesis_testing', label: 'Hypothesis Testing', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'concept' },
  { id: 'bayesian_inference', label: 'Bayesian Inference', domain: 'Probability & Statistics', level: 2, difficulty: 4, type: 'concept' },
  { id: 'map_estimation', label: 'MAP Estimation', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'concept' },
  { id: 'markov_chains', label: 'Markov Chains', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'concept' },

  // --- Optimization (parent) ---
  { id: 'optimization', label: 'Optimization', domain: 'Optimization', level: 1, difficulty: 3, type: 'concept' },
  { id: 'gradient_descent', label: 'Gradient Descent', domain: 'Optimization', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'convex_optimization', label: 'Convex Optimization', domain: 'Optimization', level: 2, difficulty: 4, type: 'concept' },
  { id: 'lagrange_multipliers', label: 'Lagrange Multipliers', domain: 'Optimization', level: 2, difficulty: 4, type: 'concept' },
  { id: 'duality', label: 'Duality', domain: 'Optimization', level: 2, difficulty: 4, type: 'concept' },
  { id: 'stochastic_gradient_descent', label: 'Stochastic Gradient Descent', domain: 'Optimization', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'adam_optimizer', label: 'Adam Optimizer', domain: 'Optimization', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'learning_rate', label: 'Learning Rate', domain: 'Optimization', level: 2, difficulty: 2, type: 'concept' },
  { id: 'momentum', label: 'Momentum', domain: 'Optimization', level: 2, difficulty: 3, type: 'concept' },
  { id: 'loss_function', label: 'Loss Function', domain: 'Optimization', level: 2, difficulty: 2, type: 'concept' },
  { id: 'cross_entropy_loss', label: 'Cross Entropy Loss', domain: 'Optimization', level: 2, difficulty: 3, type: 'concept' },

  // --- Calculus (parent) ---
  { id: 'calculus', label: 'Calculus', domain: 'Calculus', level: 1, difficulty: 2, type: 'concept' },
  { id: 'partial_derivatives', label: 'Partial Derivatives', domain: 'Calculus', level: 2, difficulty: 2, type: 'concept' },
  { id: 'chain_rule', label: 'Chain Rule', domain: 'Calculus', level: 2, difficulty: 2, type: 'theorem' },
  { id: 'taylor_expansion', label: 'Taylor Expansion', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },
  { id: 'gradient', label: 'Gradient', domain: 'Calculus', level: 2, difficulty: 2, type: 'concept' },
  { id: 'jacobian', label: 'Jacobian', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },
  { id: 'hessian', label: 'Hessian', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },
  { id: 'integration', label: 'Integration', domain: 'Calculus', level: 2, difficulty: 2, type: 'concept' },
  { id: 'multivariable_calculus', label: 'Multivariable Calculus', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },

  // ============================================================
  // LEVEL 1 — Computer Science Core
  // ============================================================

  // --- Algorithms (parent) ---
  { id: 'algorithms', label: 'Algorithms', domain: 'Algorithms', level: 1, difficulty: 2, type: 'concept' },
  { id: 'sorting', label: 'Sorting', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'dynamic_programming', label: 'Dynamic Programming', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'graph_algorithms', label: 'Graph Algorithms', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'greedy_algorithms', label: 'Greedy Algorithms', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'divide_and_conquer', label: 'Divide and Conquer', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'binary_search', label: 'Binary Search', domain: 'Algorithms', level: 2, difficulty: 1, type: 'algorithm' },
  { id: 'bfs', label: 'Breadth-First Search', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'dfs', label: 'Depth-First Search', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'dijkstra', label: 'Dijkstra\'s Algorithm', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'backtracking', label: 'Backtracking', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },

  // --- Data Structures (parent) ---
  { id: 'data_structures', label: 'Data Structures', domain: 'Data Structures', level: 1, difficulty: 2, type: 'concept' },
  { id: 'trees', label: 'Trees', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'hash_tables', label: 'Hash Tables', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'heaps', label: 'Heaps', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'graphs_ds', label: 'Graphs', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'linked_lists', label: 'Linked Lists', domain: 'Data Structures', level: 2, difficulty: 1, type: 'concept' },
  { id: 'stacks_queues', label: 'Stacks & Queues', domain: 'Data Structures', level: 2, difficulty: 1, type: 'concept' },
  { id: 'binary_search_tree', label: 'Binary Search Tree', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'trie', label: 'Trie', domain: 'Data Structures', level: 2, difficulty: 3, type: 'concept' },

  // --- Complexity Theory (parent) ---
  { id: 'complexity_theory', label: 'Complexity Theory', domain: 'Complexity Theory', level: 1, difficulty: 3, type: 'concept' },
  { id: 'big_o_notation', label: 'Big-O Notation', domain: 'Complexity Theory', level: 2, difficulty: 2, type: 'concept' },
  { id: 'p_vs_np', label: 'P vs NP', domain: 'Complexity Theory', level: 2, difficulty: 4, type: 'concept' },
  { id: 'np_completeness', label: 'NP-Completeness', domain: 'Complexity Theory', level: 2, difficulty: 4, type: 'concept' },
  { id: 'time_complexity', label: 'Time Complexity', domain: 'Complexity Theory', level: 2, difficulty: 2, type: 'concept' },
  { id: 'space_complexity', label: 'Space Complexity', domain: 'Complexity Theory', level: 2, difficulty: 2, type: 'concept' },

  // --- Operating Systems (parent) ---
  { id: 'operating_systems', label: 'Operating Systems', domain: 'Operating Systems', level: 1, difficulty: 3, type: 'concept' },
  { id: 'processes', label: 'Processes', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'threads', label: 'Threads', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'cpu_scheduling', label: 'CPU Scheduling', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'io_scheduling', label: 'I/O Scheduling', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'context_switching', label: 'Context Switching', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'synchronization', label: 'Synchronization', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'deadlocks', label: 'Deadlocks', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'memory_management', label: 'Memory Management', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'virtual_memory', label: 'Virtual Memory', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'paging', label: 'Paging', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'file_systems', label: 'File Systems', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'file_permissions', label: 'File Permissions', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'virtual_file_system', label: 'Virtual File System', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'inode', label: 'Inode', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'journaling_file_systems', label: 'Journaling File Systems', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'filesystem_cache', label: 'Filesystem Cache', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'system_calls', label: 'System Calls', domain: 'Operating Systems', level: 2, difficulty: 2, type: 'concept' },
  { id: 'interprocess_communication', label: 'Interprocess Communication', domain: 'Operating Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'memory_model', label: 'Memory Model', domain: 'Operating Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'sequential_consistency', label: 'Sequential Consistency', domain: 'Operating Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'happens_before', label: 'Happens-Before', domain: 'Operating Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'acquire_release', label: 'Acquire-Release', domain: 'Operating Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'relaxed_memory_model', label: 'Relaxed Memory Model', domain: 'Operating Systems', level: 2, difficulty: 5, type: 'concept' },

  // --- Computer Networks (parent) ---
  { id: 'computer_networks', label: 'Computer Networks', domain: 'Computer Networks', level: 1, difficulty: 3, type: 'concept' },
  { id: 'osi_model', label: 'OSI Model', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'tcp_ip_model', label: 'TCP/IP Model', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'ip_addressing', label: 'IP Addressing', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'subnetting', label: 'Subnetting', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'routing', label: 'Routing', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'arp', label: 'ARP', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'dns', label: 'DNS', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'tcp', label: 'TCP', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'udp', label: 'UDP', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'http', label: 'HTTP', domain: 'Computer Networks', level: 2, difficulty: 2, type: 'concept' },
  { id: 'tls', label: 'TLS', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'congestion_control', label: 'Congestion Control', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'tcp_slow_start', label: 'TCP Slow Start', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'tcp_congestion_avoidance', label: 'TCP Congestion Avoidance', domain: 'Computer Networks', level: 2, difficulty: 3, type: 'concept' },
  { id: 'tcp_reno', label: 'TCP Reno', domain: 'Computer Networks', level: 2, difficulty: 4, type: 'concept' },
  { id: 'tcp_cubic', label: 'TCP CUBIC', domain: 'Computer Networks', level: 2, difficulty: 4, type: 'concept' },
  { id: 'tcp_bbr', label: 'TCP BBR', domain: 'Computer Networks', level: 2, difficulty: 4, type: 'concept' },

  // --- Databases (parent) ---
  { id: 'databases', label: 'Databases', domain: 'Databases', level: 1, difficulty: 3, type: 'concept' },
  { id: 'relational_model', label: 'Relational Model', domain: 'Databases', level: 2, difficulty: 2, type: 'concept' },
  { id: 'sql', label: 'SQL', domain: 'Databases', level: 2, difficulty: 2, type: 'concept' },
  { id: 'normalization', label: 'Normalization', domain: 'Databases', level: 2, difficulty: 3, type: 'concept' },
  { id: 'indexes', label: 'Indexes', domain: 'Databases', level: 2, difficulty: 3, type: 'concept' },
  { id: 'transactions', label: 'Transactions', domain: 'Databases', level: 2, difficulty: 3, type: 'concept' },
  { id: 'isolation_levels', label: 'Isolation Levels', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'query_planning', label: 'Query Planning', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'replication_db', label: 'Replication (DB)', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'sharding_db', label: 'Sharding', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'btree_index', label: 'B-Tree Index', domain: 'Databases', level: 2, difficulty: 3, type: 'concept' },
  { id: 'hash_index', label: 'Hash Index', domain: 'Databases', level: 2, difficulty: 3, type: 'concept' },
  { id: 'bitmap_index', label: 'Bitmap Index', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'gin_index', label: 'GIN Index', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },
  { id: 'gist_index', label: 'GiST Index', domain: 'Databases', level: 2, difficulty: 4, type: 'concept' },

  // --- Distributed Systems (parent) ---
  { id: 'distributed_systems', label: 'Distributed Systems', domain: 'Distributed Systems', level: 1, difficulty: 4, type: 'concept' },
  { id: 'cap_theorem', label: 'CAP Theorem', domain: 'Distributed Systems', level: 2, difficulty: 4, type: 'theorem' },
  { id: 'consistency_models', label: 'Consistency Models', domain: 'Distributed Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'consensus', label: 'Consensus', domain: 'Distributed Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'raft', label: 'Raft', domain: 'Distributed Systems', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'paxos', label: 'Paxos', domain: 'Distributed Systems', level: 2, difficulty: 5, type: 'algorithm' },
  { id: 'leader_election', label: 'Leader Election', domain: 'Distributed Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'replication', label: 'Replication', domain: 'Distributed Systems', level: 2, difficulty: 4, type: 'concept' },
  { id: 'partitioning', label: 'Partitioning', domain: 'Distributed Systems', level: 2, difficulty: 3, type: 'concept' },
  { id: 'distributed_transactions', label: 'Distributed Transactions', domain: 'Distributed Systems', level: 2, difficulty: 5, type: 'concept' },

  // --- Systems Performance (parent) ---
  { id: 'systems_performance', label: 'Systems Performance', domain: 'Systems Performance', level: 1, difficulty: 3, type: 'concept' },
  { id: 'latency', label: 'Latency', domain: 'Systems Performance', level: 2, difficulty: 2, type: 'concept' },
  { id: 'throughput', label: 'Throughput', domain: 'Systems Performance', level: 2, difficulty: 2, type: 'concept' },
  { id: 'caching', label: 'Caching', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },
  { id: 'load_balancing', label: 'Load Balancing', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },
  { id: 'backpressure', label: 'Backpressure', domain: 'Systems Performance', level: 2, difficulty: 4, type: 'concept' },
  { id: 'rate_limiting', label: 'Rate Limiting', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },
  { id: 'circuit_breaker', label: 'Circuit Breaker', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },
  { id: 'profiling', label: 'Profiling', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },
  { id: 'observability', label: 'Observability', domain: 'Systems Performance', level: 2, difficulty: 3, type: 'concept' },

  // --- Security (parent) ---
  { id: 'security', label: 'Security', domain: 'Security', level: 1, difficulty: 3, type: 'concept' },
  { id: 'authentication', label: 'Authentication', domain: 'Security', level: 2, difficulty: 2, type: 'concept' },
  { id: 'authorization', label: 'Authorization', domain: 'Security', level: 2, difficulty: 2, type: 'concept' },
  { id: 'cryptography', label: 'Cryptography', domain: 'Security', level: 2, difficulty: 4, type: 'concept' },
  { id: 'hashing', label: 'Hashing', domain: 'Security', level: 2, difficulty: 2, type: 'concept' },
  { id: 'symmetric_encryption', label: 'Symmetric Encryption', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },
  { id: 'asymmetric_encryption', label: 'Asymmetric Encryption', domain: 'Security', level: 2, difficulty: 4, type: 'concept' },
  { id: 'threat_modeling', label: 'Threat Modeling', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },
  { id: 'web_security', label: 'Web Security', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },
  { id: 'xss', label: 'XSS', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },
  { id: 'csrf', label: 'CSRF', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },
  { id: 'sql_injection', label: 'SQL Injection', domain: 'Security', level: 2, difficulty: 3, type: 'concept' },

  // --- Software Engineering (parent) ---
  { id: 'software_engineering', label: 'Software Engineering', domain: 'Software Engineering', level: 1, difficulty: 3, type: 'concept' },
  { id: 'testing', label: 'Testing', domain: 'Software Engineering', level: 2, difficulty: 2, type: 'concept' },
  { id: 'unit_testing', label: 'Unit Testing', domain: 'Software Engineering', level: 2, difficulty: 2, type: 'concept' },
  { id: 'integration_testing', label: 'Integration Testing', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'end_to_end_testing', label: 'End-to-End Testing', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'contract_testing', label: 'Contract Testing', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'property_based_testing', label: 'Property-Based Testing', domain: 'Software Engineering', level: 2, difficulty: 4, type: 'concept' },
  { id: 'load_testing', label: 'Load Testing', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'mutation_testing', label: 'Mutation Testing', domain: 'Software Engineering', level: 2, difficulty: 4, type: 'concept' },
  { id: 'design_patterns', label: 'Design Patterns', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'clean_architecture', label: 'Clean Architecture', domain: 'Software Engineering', level: 2, difficulty: 4, type: 'concept' },
  { id: 'code_review', label: 'Code Review', domain: 'Software Engineering', level: 2, difficulty: 2, type: 'concept' },
  { id: 'ci_cd', label: 'CI/CD', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },
  { id: 'version_control', label: 'Version Control', domain: 'Software Engineering', level: 2, difficulty: 2, type: 'concept' },
  { id: 'dependency_management', label: 'Dependency Management', domain: 'Software Engineering', level: 2, difficulty: 3, type: 'concept' },

  // --- Programming Languages & Compilers (parent) ---
  { id: 'programming_languages', label: 'Programming Languages', domain: 'Programming Languages', level: 1, difficulty: 3, type: 'concept' },
  { id: 'type_systems', label: 'Type Systems', domain: 'Programming Languages', level: 2, difficulty: 4, type: 'concept' },
  { id: 'compilers', label: 'Compilers', domain: 'Programming Languages', level: 2, difficulty: 4, type: 'concept' },
  { id: 'parsing', label: 'Parsing', domain: 'Programming Languages', level: 2, difficulty: 3, type: 'concept' },
  { id: 'ast', label: 'Abstract Syntax Tree', domain: 'Programming Languages', level: 2, difficulty: 3, type: 'concept' },
  { id: 'interpreters', label: 'Interpreters', domain: 'Programming Languages', level: 2, difficulty: 3, type: 'concept' },
  { id: 'garbage_collection', label: 'Garbage Collection', domain: 'Programming Languages', level: 2, difficulty: 4, type: 'concept' },
  { id: 'memory_safety', label: 'Memory Safety', domain: 'Programming Languages', level: 2, difficulty: 3, type: 'concept' },

  // ============================================================
  // LEVEL 1 — Machine Learning
  // ============================================================

  // --- Supervised Learning (parent) ---
  { id: 'supervised_learning', label: 'Supervised Learning', domain: 'Supervised Learning', level: 1, difficulty: 2, type: 'concept' },
  { id: 'linear_regression', label: 'Linear Regression', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'model' },
  { id: 'logistic_regression', label: 'Logistic Regression', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'svm', label: 'Support Vector Machine', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'knn', label: 'k-Nearest Neighbors', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'distance_metrics', label: 'Distance Metrics', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'feature_scaling', label: 'Feature Scaling', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'decision_tree', label: 'Decision Tree', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'model' },
  { id: 'random_forest', label: 'Random Forest', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'gradient_boosting', label: 'Gradient Boosting', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'naive_bayes', label: 'Naive Bayes', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'model' },
  { id: 'overfitting', label: 'Overfitting', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'cross_validation', label: 'Cross Validation', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'train_test_split', label: 'Train/Test Split', domain: 'Supervised Learning', level: 2, difficulty: 1, type: 'concept' },
  { id: 'data_leakage', label: 'Data Leakage', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'feature_engineering', label: 'Feature Engineering', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'feature_selection', label: 'Feature Selection', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'feature_importance', label: 'Feature Importance', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'model_interpretability', label: 'Model Interpretability', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'ensemble_methods', label: 'Ensemble Methods', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },

  // --- Unsupervised Learning (parent) ---
  { id: 'unsupervised_learning', label: 'Unsupervised Learning', domain: 'Unsupervised Learning', level: 1, difficulty: 3, type: 'concept' },
  { id: 'k_means', label: 'k-Means', domain: 'Unsupervised Learning', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'pca', label: 'Principal Component Analysis', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'gaussian_mixture_models', label: 'Gaussian Mixture Models', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'dbscan', label: 'DBSCAN', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'hierarchical_clustering', label: 'Hierarchical Clustering', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'em_algorithm', label: 'Expectation-Maximization', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'dimensionality_reduction', label: 'Dimensionality Reduction', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'autoencoder', label: 'Autoencoder', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 't_sne', label: 't-SNE', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'algorithm' },

  // --- Reinforcement Learning (parent) ---
  { id: 'reinforcement_learning', label: 'Reinforcement Learning', domain: 'Reinforcement Learning', level: 1, difficulty: 4, type: 'concept' },
  { id: 'mdp', label: 'Markov Decision Process', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'bellman_equation', label: 'Bellman Equation', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'theorem' },
  { id: 'q_learning', label: 'Q-Learning', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'policy_gradient', label: 'Policy Gradient', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'value_function', label: 'Value Function', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'exploration_exploitation', label: 'Exploration vs Exploitation', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'sparse_rewards', label: 'Sparse Rewards', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'temporal_difference', label: 'Temporal Difference Learning', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'actor_critic', label: 'Actor-Critic', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'reward_shaping', label: 'Reward Shaping', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'potential_based_shaping', label: 'Potential-Based Shaping', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'intrinsic_motivation', label: 'Intrinsic Motivation', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'reward_hacking', label: 'Reward Hacking', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'concept' },

  // ============================================================
  // LEVEL 1 — Deep Learning
  // ============================================================

  { id: 'deep_learning', label: 'Deep Learning', domain: 'Deep Learning', level: 1, difficulty: 3, type: 'concept' },
  { id: 'neural_networks', label: 'Neural Networks', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'backpropagation', label: 'Backpropagation', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'cnn', label: 'Convolutional Neural Network', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'rnn', label: 'Recurrent Neural Network', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'lstm', label: 'Long Short-Term Memory', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'transformer', label: 'Transformer', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'attention_mechanism', label: 'Attention Mechanism', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'regularization', label: 'Regularization', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'batch_normalization', label: 'Batch Normalization', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'dropout', label: 'Dropout', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'activation_functions', label: 'Activation Functions', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'relu', label: 'ReLU', domain: 'Deep Learning', level: 2, difficulty: 1, type: 'concept' },
  { id: 'sigmoid', label: 'Sigmoid', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'softmax', label: 'Softmax', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'weight_initialization', label: 'Weight Initialization', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'vanishing_gradient', label: 'Vanishing Gradient Problem', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'residual_connections', label: 'Residual Connections', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'gan', label: 'Generative Adversarial Network', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'vae', label: 'Variational Autoencoder', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'transfer_learning', label: 'Transfer Learning', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'fine_tuning', label: 'Fine-Tuning', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'embeddings', label: 'Embeddings', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'word2vec', label: 'Word2Vec', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'positional_encoding', label: 'Positional Encoding', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'multi_head_attention', label: 'Multi-Head Attention', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'layer_normalization', label: 'Layer Normalization', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'bert', label: 'BERT', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'gpt', label: 'GPT', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'diffusion_models', label: 'Diffusion Models', domain: 'Deep Learning', level: 2, difficulty: 5, type: 'model' },

  // ============================================================
  // LEVEL 1 — Theoretical ML
  // ============================================================

  { id: 'theoretical_ml', label: 'Theoretical ML', domain: 'Theoretical ML', level: 1, difficulty: 4, type: 'concept' },
  { id: 'vc_dimension', label: 'VC Dimension', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'concept' },
  { id: 'pac_learning', label: 'PAC Learning', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'concept' },
  { id: 'bias_variance_tradeoff', label: 'Bias-Variance Tradeoff', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'information_theory', label: 'Information Theory', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'kl_divergence', label: 'KL Divergence', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'mutual_information', label: 'Mutual Information', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'entropy', label: 'Entropy', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'no_free_lunch', label: 'No Free Lunch Theorem', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'theorem' },
  { id: 'rademacher_complexity', label: 'Rademacher Complexity', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'concept' },
  { id: 'generalization_bounds', label: 'Generalization Bounds', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'concept' },
  { id: 'statistical_learning_theory', label: 'Statistical Learning Theory', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'concept' },

  // ============================================================
  // EXTENDED CORE NODES (MVP expansion to 200~400 target)
  // ============================================================

  // Linear Algebra extensions
  { id: 'rank', label: 'Matrix Rank', domain: 'Linear Algebra', level: 2, difficulty: 2, type: 'concept' },
  { id: 'null_space', label: 'Null Space', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'column_space', label: 'Column Space', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'change_of_basis', label: 'Change of Basis', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'projection_matrix', label: 'Projection Matrix', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'orthonormal_basis', label: 'Orthonormal Basis', domain: 'Linear Algebra', level: 2, difficulty: 3, type: 'concept' },
  { id: 'spectral_theorem', label: 'Spectral Theorem', domain: 'Linear Algebra', level: 2, difficulty: 4, type: 'theorem' },
  { id: 'moore_penrose_pseudoinverse', label: 'Moore-Penrose Pseudoinverse', domain: 'Linear Algebra', level: 2, difficulty: 4, type: 'concept' },

  // Probability & Statistics extensions
  { id: 'bernoulli_distribution', label: 'Bernoulli Distribution', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'binomial_distribution', label: 'Binomial Distribution', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'poisson_distribution', label: 'Poisson Distribution', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'exponential_distribution', label: 'Exponential Distribution', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'sampling_methods', label: 'Sampling Methods', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'monte_carlo_methods', label: 'Monte Carlo Methods', domain: 'Probability & Statistics', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'confidence_interval', label: 'Confidence Interval', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },
  { id: 'a_b_testing', label: 'A/B Testing', domain: 'Probability & Statistics', level: 2, difficulty: 2, type: 'concept' },

  // Optimization extensions
  { id: 'constrained_optimization', label: 'Constrained Optimization', domain: 'Optimization', level: 2, difficulty: 4, type: 'concept' },
  { id: 'projected_gradient_descent', label: 'Projected Gradient Descent', domain: 'Optimization', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'newton_method', label: "Newton's Method", domain: 'Optimization', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'line_search', label: 'Line Search', domain: 'Optimization', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'l1_regularization', label: 'L1 Regularization', domain: 'Optimization', level: 2, difficulty: 3, type: 'concept' },
  { id: 'l2_regularization', label: 'L2 Regularization', domain: 'Optimization', level: 2, difficulty: 3, type: 'concept' },
  { id: 'proximal_gradient', label: 'Proximal Gradient', domain: 'Optimization', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'kkt_conditions', label: 'KKT Conditions', domain: 'Optimization', level: 2, difficulty: 5, type: 'theorem' },

  // Calculus extensions
  { id: 'limits', label: 'Limits', domain: 'Calculus', level: 2, difficulty: 1, type: 'concept' },
  { id: 'continuity', label: 'Continuity', domain: 'Calculus', level: 2, difficulty: 1, type: 'concept' },
  { id: 'multivariate_chain_rule', label: 'Multivariate Chain Rule', domain: 'Calculus', level: 2, difficulty: 3, type: 'theorem' },
  { id: 'directional_derivative', label: 'Directional Derivative', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },
  { id: 'implicit_function_theorem', label: 'Implicit Function Theorem', domain: 'Calculus', level: 2, difficulty: 4, type: 'theorem' },
  { id: 'jacobian_determinant', label: 'Jacobian Determinant', domain: 'Calculus', level: 2, difficulty: 3, type: 'concept' },

  // Algorithms extensions
  { id: 'shortest_path_algorithms', label: 'Shortest Path Algorithms', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'minimum_spanning_tree', label: 'Minimum Spanning Tree', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'topological_sort', label: 'Topological Sort', domain: 'Algorithms', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'floyd_warshall', label: 'Floyd-Warshall', domain: 'Algorithms', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'bellman_ford', label: 'Bellman-Ford', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'union_find', label: 'Union-Find', domain: 'Algorithms', level: 2, difficulty: 2, type: 'concept' },
  { id: 'amortized_analysis', label: 'Amortized Analysis', domain: 'Algorithms', level: 2, difficulty: 3, type: 'concept' },
  { id: 'string_matching', label: 'String Matching', domain: 'Algorithms', level: 2, difficulty: 3, type: 'algorithm' },

  // Data Structures extensions
  { id: 'disjoint_set', label: 'Disjoint Set', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'priority_queue', label: 'Priority Queue', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },
  { id: 'segment_tree', label: 'Segment Tree', domain: 'Data Structures', level: 2, difficulty: 3, type: 'concept' },
  { id: 'fenwick_tree', label: 'Fenwick Tree', domain: 'Data Structures', level: 2, difficulty: 3, type: 'concept' },
  { id: 'b_tree', label: 'B-Tree', domain: 'Data Structures', level: 2, difficulty: 3, type: 'concept' },
  { id: 'bloom_filter', label: 'Bloom Filter', domain: 'Data Structures', level: 2, difficulty: 3, type: 'concept' },
  { id: 'adjacency_list', label: 'Adjacency List', domain: 'Data Structures', level: 2, difficulty: 2, type: 'concept' },

  // Complexity Theory extensions
  { id: 'reduction', label: 'Reduction', domain: 'Complexity Theory', level: 2, difficulty: 3, type: 'concept' },
  { id: 'polynomial_time', label: 'Polynomial Time', domain: 'Complexity Theory', level: 2, difficulty: 2, type: 'concept' },
  { id: 'nondeterminism', label: 'Nondeterminism', domain: 'Complexity Theory', level: 2, difficulty: 3, type: 'concept' },
  { id: 'decision_problem', label: 'Decision Problem', domain: 'Complexity Theory', level: 2, difficulty: 2, type: 'concept' },
  { id: 'approximation_algorithms', label: 'Approximation Algorithms', domain: 'Complexity Theory', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'randomized_algorithms', label: 'Randomized Algorithms', domain: 'Complexity Theory', level: 2, difficulty: 3, type: 'algorithm' },

  // Supervised Learning extensions
  { id: 'ridge_regression', label: 'Ridge Regression', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'lasso_regression', label: 'Lasso Regression', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'roc_auc', label: 'ROC-AUC', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'precision_recall', label: 'Precision-Recall', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'class_imbalance', label: 'Class Imbalance', domain: 'Supervised Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'hyperparameter_tuning', label: 'Hyperparameter Tuning', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'probability_calibration', label: 'Probability Calibration', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'xgboost', label: 'XGBoost', domain: 'Supervised Learning', level: 2, difficulty: 3, type: 'model' },

  // Unsupervised Learning extensions
  { id: 'spectral_clustering', label: 'Spectral Clustering', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'algorithm' },
  { id: 'latent_variable_models', label: 'Latent Variable Models', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'manifold_learning', label: 'Manifold Learning', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'umap', label: 'UMAP', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'anomaly_detection', label: 'Anomaly Detection', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'isolation_forest', label: 'Isolation Forest', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'model' },
  { id: 'self_supervised_learning', label: 'Self-Supervised Learning', domain: 'Unsupervised Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'contrastive_learning', label: 'Contrastive Learning', domain: 'Unsupervised Learning', level: 2, difficulty: 4, type: 'algorithm' },

  // Reinforcement Learning extensions
  { id: 'monte_carlo_rl', label: 'Monte Carlo RL', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'sarsa', label: 'SARSA', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'epsilon_greedy', label: 'Epsilon-Greedy', domain: 'Reinforcement Learning', level: 2, difficulty: 2, type: 'algorithm' },
  { id: 'policy_iteration', label: 'Policy Iteration', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'value_iteration', label: 'Value Iteration', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'algorithm' },
  { id: 'model_based_rl', label: 'Model-Based RL', domain: 'Reinforcement Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'off_policy_learning', label: 'Off-Policy Learning', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'on_policy_learning', label: 'On-Policy Learning', domain: 'Reinforcement Learning', level: 2, difficulty: 3, type: 'concept' },

  // Deep Learning extensions
  { id: 'mlp', label: 'Multilayer Perceptron', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'model' },
  { id: 'convolution', label: 'Convolution', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'pooling', label: 'Pooling', domain: 'Deep Learning', level: 2, difficulty: 2, type: 'concept' },
  { id: 'sequence_modeling', label: 'Sequence Modeling', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'self_attention', label: 'Self-Attention', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'masked_language_modeling', label: 'Masked Language Modeling', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'instruction_tuning', label: 'Instruction Tuning', domain: 'Deep Learning', level: 2, difficulty: 3, type: 'concept' },
  { id: 'parameter_efficient_finetuning', label: 'Parameter-Efficient Fine-Tuning', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'concept' },
  { id: 'mixture_of_experts', label: 'Mixture of Experts', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'model' },
  { id: 'rlhf', label: 'Reinforcement Learning from Human Feedback', domain: 'Deep Learning', level: 2, difficulty: 4, type: 'concept' },

  // Theoretical ML extensions
  { id: 'empirical_risk_minimization', label: 'Empirical Risk Minimization', domain: 'Theoretical ML', level: 2, difficulty: 3, type: 'concept' },
  { id: 'structural_risk_minimization', label: 'Structural Risk Minimization', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'concept' },
  { id: 'concentration_inequalities', label: 'Concentration Inequalities', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'concept' },
  { id: 'chernoff_bound', label: 'Chernoff Bound', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'theorem' },
  { id: 'fano_inequality', label: 'Fano Inequality', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'theorem' },
  { id: 'pinsker_inequality', label: 'Pinsker Inequality', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'theorem' },
  { id: 'rate_distortion_theory', label: 'Rate-Distortion Theory', domain: 'Theoretical ML', level: 2, difficulty: 5, type: 'concept' },
  { id: 'minimum_description_length', label: 'Minimum Description Length', domain: 'Theoretical ML', level: 2, difficulty: 4, type: 'concept' },

];

// Export node count for reference
export const NODE_COUNT = GRAPH_NODES.length;
