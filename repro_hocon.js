testcraft {
"version": "1.0"
  plan {
"name": "YugabyteDB-Chaos-Bank-Consistency"
"description": "Validated transaction consistency during high-contention bank transfers with simultaneous node failures and network partitions."

    variables {
"db_host": "localhost"
"db_port": 5433
"db_user": "yugabyte"
"db_pass": "yugabyte"
"db_name": "testcraft"
"num_accounts": 100
"initial_balance": 1000
"total_expected_balance": 100000
"transfer_amount": 10
"chaos_interval_ms": 15000
"target_tserver_pod": "yb-tserver-1"
"namespace": "yugabyte-db"
    }
"nodes": [
      {
"name": "Initialize-Database"
"type": "JDBC-Sampler"
        config {
"connection": "jdbc:postgresql:
"user": "${db_user}"
"password": "${db_pass}"
"sql": "\n            DROP TABLE IF EXISTS bank_accounts;\n            CREATE TABLE bank_accounts (\n              id INT PRIMARY KEY,\n              balance INT NOT NULL,\n              last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n            );\n          "
        }
      },
      {
"name": "Seed-Accounts"
"type": "JDBC-Sampler"
        config {
"connection": "jdbc:postgresql:
"user": "${db_user}"
"password": "${db_pass}"
"sql": "\n            INSERT INTO bank_accounts (id, balance)\n            SELECT i, 1000\n            FROM generate_series(1, 100) AS i;\n          "
        }
      },
      {
"name": "Execution-Parallel-Group"
"type": "Parallel-Controller"
"children": [
          {
"name": "Bank-Transfer-Loop"
"type": "Loop-Controller"
            config {
"duration_ms": 120000
"concurrency": 20
            }
"children": [
              {
"name": "Randomize-Accounts"
"type": "Script-Node"
                config {
"language": "javascript"
"code": "\n                    const num: 100;\n                    const from: Math.floor(Math.random() * num) + 1;\n                    let to: Math.floor(Math.random() * num) + 1;\n                    while (to: : : from) { "to": Math.floor(Math.random() * num) + 1; }\n                    context.vars.from_account: from;\n                    context.vars.to_account: to;\n                  "
                }
              },
              {
"name": "Execute-Transfer-Transaction"
"type": "JDBC-Sampler"
                config {
"connection": "jdbc:postgresql:
"user": "${db_user}"
"password": "${db_pass}"
"sql": "\n                    BEGIN;\n                    UPDATE bank_accounts\n                    SET balance: balance - 10, "last_updated": CURRENT_TIMESTAMP\n                    WHERE id: ${from_account} AND balance >: 10;\n                    UPDATE bank_accounts\n                    SET balance: balance + 10, "last_updated": CURRENT_TIMESTAMP\n                    WHERE id: ${to_account};\n                    COMMIT;\n                  "
                }
              }
            ]
          },
          {
"name": "Node-Restart-Nemesis"
"type": "Loop-Controller"
            config {
"duration_ms": 120000
"delay_ms": 15000
            }
"children": [
              {
"name": "Restart-TServer-Pod"
"type": "Kubernetes-Node"
                config {
"action": "restart-pod"
"namespace": "yugabyte-db"
"podName": "yb-tserver-1"
"gracePeriod": 0
                }
              },
              {
"name": "Wait-for-Recovery"
"type": "Constant-Timer"
                config {
"delay_ms": 10000
                }
              }
            ]
          }
        ]
      },
      {
"name": "Verify-Total-Balance"
"type": "JDBC-Sampler"
        config {
"connection": "jdbc:postgresql:
"user": "${db_user}"
"password": "${db_pass}"
"sql": "SELECT SUM(balance) as total_balance FROM bank_accounts;"
        }
      }
    ]
  }
}

Invalid JSON: Unexpected token 'e', "testcraft {"... is not valid JSON
