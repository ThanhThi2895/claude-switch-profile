# Homebrew Formula Template for claude-switch-profile
#
# INSTRUCTIONS FOR MAINTAINER:
# 1. Create a new GitHub repository named `homebrew-tap` (e.g. `ThanhThi2895/homebrew-tap`).
# 2. Inside that repository, create a `Formula/` directory.
# 3. Copy this file into `Formula/claude-switch-profile.rb`.
# 4. Update the `url` and `sha256` fields with the latest npm tarball release.
#    (You can get the tarball url from `npm view claude-switch-profile dist.tarball`)
#    (You must calculate the sha256 of the tarball, e.g. `curl -sL <tarball_url> | shasum -a 256`)

require "language/node"

class ClaudeSwitchProfile < Formula
  desc "CLI tool for managing multiple Claude Code profiles"
  homepage "https://github.com/ThanhThi2895/claude-switch-profile"
  url "https://registry.npmjs.org/claude-switch-profile/-/claude-switch-profile-1.4.17.tgz"
  sha256 "REPLACE_WITH_ACTUAL_SHA256_OF_TARBALL"
  license "MIT"

  depends_on "node"

  def install
    # Language::Node.std_npm_install_args securely installs the node module into
    # the Homebrew Cellar, making it completely independent of any global Node.js 
    # managers like NVM or FNM that the user might be running.
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    # Simple test to verify the CLI initializes correctly
    assert_match "Usage: csp", shell_output("#{bin}/csp --help")
  end
end
